/**
 * 一次性脚本：给 COS 中 images/ 前缀下所有历史对象补
 * Content-Disposition: inline 元数据，避免浏览器导航时被 COS
 * 动态注入 attachment 导致"新窗口打开"变下载。
 *
 * 实现方式：putObjectCopy 自拷贝（同桶源=目标），并设置
 * MetadataDirective: 'Replaced' + Headers 中带 Content-Disposition: inline。
 * 替换模式会覆盖对象全部自定义元数据，所以同时保留 ContentType。
 *
 * 用法：
 *   bun run packages/briar-node/scripts/fix-image-disposition.ts
 *   # 可选：--prefix=images/  --dry-run  --concurrency=10
 *
 * 注意：
 * - 此脚本会遍历所有 images/ 前缀对象，对每个对象发起一次 COPY 请求。
 * - --dry-run 只打印不修改，强烈建议先跑一次 dry-run 确认范围。
 * - 已是 inline 的对象会被跳过（先 headObject 检查）。
 */

import fs from 'fs'
import path from 'path'
import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'

// ---- 参数 ----
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const prefixArg = args.find((a) => a.startsWith('--prefix='))
const concurrencyArg = args.find((a) => a.startsWith('--concurrency='))
const PREFIX = (prefixArg ? prefixArg.split('=')[1] : 'images/').replace(/^\/+/, '')
const CONCURRENCY = concurrencyArg ? Number.parseInt(concurrencyArg.split('=')[1], 10) || 5 : 5

// ---- 环境变量 ----
const findRepoRoot = (startDir: string) => {
	let currentDir = startDir
	while (true) {
		if (fs.existsSync(path.join(currentDir, 'bun.lock'))) {
			return currentDir
		}
		const parentDir = path.dirname(currentDir)
		if (parentDir === currentDir) return startDir
		currentDir = parentDir
	}
}

const repoRoot = findRepoRoot(process.cwd())
dotenv.config({ path: path.join(repoRoot, '.env') })

const region = process.env.BRIAR_TX_BUCKET_REGION
const secretId = process.env.BRIAR_TX_SEC_ID
const secretKey = process.env.BRIAR_TX_SEC_KEY
const bucket = process.env.BRIAR_TX_BUCKET_NAME

if (!region || !secretId || !secretKey || !bucket) {
	console.error(
		'Missing COS env vars. Required: BRIAR_TX_BUCKET_REGION, BRIAR_TX_SEC_ID, BRIAR_TX_SEC_KEY, BRIAR_TX_BUCKET_NAME',
	)
	process.exit(1)
}

const cos = new COS({
	SecretId: secretId,
	SecretKey: secretKey,
	Timeout: 30000,
	// 关闭 KeepAlive，避免 COS 服务端关连接后写 socket 触发 EPIPE 崩溃
	KeepAlive: false,
})

// ---- 工具函数 ----

interface CosObject {
	Key: string
	Size: number
}

/** 列举前缀下全部对象（自动分页） */
const listAllObjects = async (prefix: string): Promise<CosObject[]> => {
	const all: CosObject[] = []
	let marker: string | undefined
	do {
		const res: any = await new Promise((resolve, reject) => {
			cos.getBucket(
				{
					Bucket: bucket,
					Region: region,
					Prefix: prefix,
					Marker: marker,
					MaxKeys: 1000,
				},
				(err, data) => {
					if (err) reject(err)
					else resolve(data)
				},
			)
		})
		const items = (res?.Contents || []).filter((it: any) => !it.Key.endsWith('/'))
		for (const it of items) {
			all.push({ Key: it.Key, Size: Number(it.Size) || 0 })
		}
		marker = res?.IsTruncated === 'true' ? res?.NextMarker : undefined
	} while (marker)
	return all
}

/** headObject 拿对象当前元数据 */
const headObject = (key: string): Promise<any> =>
	new Promise((resolve, reject) => {
		cos.headObject(
			{
				Bucket: bucket,
				Region: region,
				Key: key,
			},
			(err, data) => {
				if (err) reject(err)
				else resolve(data)
			},
		)
	})

/** putObjectCopy 自拷贝并替换元数据 */
const copyWithInlineDisposition = (key: string, contentType: string): Promise<any> =>
	new Promise((resolve, reject) => {
		cos.putObjectCopy(
			{
				Bucket: bucket,
				Region: region,
				Key: key,
				CopySource: `${bucket}.cos.${region}.myqcloud.com/${encodeURIComponent(key).replace(
					/%2F/g,
					'/',
				)}`,
				CopySourceHeaders: {},
				MetadataDirective: 'Replaced', // 替换而非复制源对象元数据
				Headers: {
					'Content-Disposition': 'inline',
					'Content-Type': contentType,
				},
			},
			(err, data) => {
				if (err) reject(err)
				else resolve(data)
			},
		)
	})

// ---- 限并发执行器 ----
const runWithConcurrency = async <T>(
	tasks: Array<() => Promise<T>>,
	limit: number,
): Promise<T[]> => {
	const results: T[] = []
	let index = 0
	const workers: Promise<void>[] = []
	const runNext = async (): Promise<void> => {
		while (index < tasks.length) {
			const myIndex = index++
			results[myIndex] = await tasks[myIndex]()
		}
	}
	for (let i = 0; i < Math.min(limit, tasks.length); i++) {
		workers.push(runNext())
	}
	await Promise.all(workers)
	return results
}

// ---- 主流程 ----
const main = async () => {
	console.log('='.repeat(60))
	console.log(`Bucket : ${bucket}`)
	console.log(`Prefix : ${PREFIX}`)
	console.log(`Dry run: ${dryRun}`)
	console.log(`Concurrency: ${CONCURRENCY}`)
	console.log('='.repeat(60))

	console.log('Listing objects ...')
	const objects = await listAllObjects(PREFIX)
	console.log(`Found ${objects.length} objects under "${PREFIX}"`)

	if (objects.length === 0) return

	let processed = 0
	let skipped = 0
	let failed = 0
	let updated = 0

	const tasks = objects.map((obj) => async () => {
		processed++
		const progress = `[${processed}/${objects.length}]`

		// 先 head 看当前 disposition
		let currentDisposition: string | undefined
		let currentContentType = 'application/octet-stream'
		try {
			const head = await headObject(obj.Key)
			currentDisposition = head?.headers?.['content-disposition']
			currentContentType = head?.headers?.['content-type'] || currentContentType
		} catch (err: any) {
			// head 失败可能是对象不存在或权限问题，跳过
			console.log(`${progress} SKIP (head failed): ${obj.Key} - ${err?.message}`)
			failed++
			return
		}

		// 已经是 inline 的跳过
		if (currentDisposition?.toLowerCase().includes('inline')) {
			console.log(`${progress} SKIP (already inline): ${obj.Key}`)
			skipped++
			return
		}

		if (dryRun) {
			console.log(
				`${progress} DRY-RUN would update: ${obj.Key} (current disposition: ${currentDisposition || '<none>'})`,
			)
			return
		}

		try {
			await copyWithInlineDisposition(obj.Key, currentContentType)
			console.log(
				`${progress} UPDATED: ${obj.Key} (was: ${currentDisposition || '<none>'} → inline)`,
			)
			updated++
		} catch (err: any) {
			console.error(`${progress} FAILED: ${obj.Key} - ${err?.message}`)
			failed++
		}
	})

	await runWithConcurrency(tasks, CONCURRENCY)

	console.log('='.repeat(60))
	console.log('Summary:')
	console.log(`  Total     : ${objects.length}`)
	console.log(`  Updated   : ${updated}`)
	console.log(`  Skipped   : ${skipped} (already inline)`)
	console.log(`  Failed    : ${failed}`)
	if (dryRun) {
		console.log('  (dry-run mode, no actual changes made)')
	}
	console.log('='.repeat(60))
}

main().catch((error) => {
	console.error('Script failed:', error)
	process.exit(1)
})
