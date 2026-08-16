import fs from 'fs'
import path from 'path'
import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'

/**
 * 一次性脚本：给存量对象补 Cache-Control: max-age=2592000（一个月）元数据。
 * 覆盖私有桶（files/ + images/，用户文件）和公开桶（avatars/，头像）。
 * 静态资源（static/）由 CI 上传脚本 upload-cdn.ts 在上传时设置，不在此处理。
 *
 * 实现方式：putObjectCopy 自拷贝（同桶源=目标）+ MetadataDirective: 'Replaced'，
 * 替换模式会覆盖全部元数据，所以同时保留 Content-Type / Content-Disposition。
 * 已有相同 Cache-Control 的对象跳过，幂等可重跑。
 *
 * 用法：bun run --filter @briar/scripts cos:cache-control
 */

const findRepoRoot = (startDir: string) => {
	let currentDir = startDir
	while (true) {
		if (fs.existsSync(path.join(currentDir, 'bun.lock'))) {
			return currentDir
		}
		const parentDir = path.dirname(currentDir)
		if (parentDir === currentDir) {
			return startDir
		}
		currentDir = parentDir
	}
}

const repoRoot = findRepoRoot(process.cwd())
dotenv.config({ path: path.join(repoRoot, '.env') })

const region = process.env.BRIAR_TX_BUCKET_REGION
const secretId = process.env.BRIAR_TX_SEC_ID
const secretKey = process.env.BRIAR_TX_SEC_KEY

const CACHE_CONTROL = 'max-age=2592000'
const CONCURRENCY = 5

/** 要处理的 桶 → 前缀 组合 */
const GROUPS = [
	{ bucket: process.env.BRIAR_TX_PRIVATE_BUCKET_NAME, prefixes: ['files/', 'images/'] },
	{ bucket: process.env.BRIAR_TX_BUCKET_NAME, prefixes: ['avatars/'] },
]

if (!region || !secretId || !secretKey || GROUPS.some((g) => !g.bucket)) {
	console.error(
		'Missing COS env vars. Required: BRIAR_TX_BUCKET_REGION, BRIAR_TX_SEC_ID, BRIAR_TX_SEC_KEY, BRIAR_TX_BUCKET_NAME, BRIAR_TX_PRIVATE_BUCKET_NAME',
	)
	process.exit(1)
}

const cos = new COS({
	SecretId: secretId,
	SecretKey: secretKey,
})

async function listAllObjects(bucket: string, prefix: string): Promise<string[]> {
	const all: string[] = []
	let marker: string | undefined
	while (true) {
		const data = await new Promise<COS.GetBucketResult>((resolve, reject) => {
			cos.getBucket(
				{ Bucket: bucket, Region: region!, Prefix: prefix, Marker: marker, MaxKeys: 1000 },
				(err, data) => (err ? reject(err) : resolve(data)),
			)
		})
		all.push(...(data.Contents || []).filter((o) => !o.Key.endsWith('/')).map((o) => o.Key))
		if (data.IsTruncated !== 'true') break
		marker = data.NextMarker || all[all.length - 1]
		if (!marker) break
	}
	return all
}

/** 补 Cache-Control；已是目标值返回 false（跳过） */
async function setCacheControl(bucket: string, key: string): Promise<boolean> {
	const head = await new Promise<COS.HeadObjectResult>((resolve, reject) => {
		cos.headObject({ Bucket: bucket, Region: region!, Key: key }, (err, data) =>
			err ? reject(err) : resolve(data),
		)
	})
	const headers = head?.headers || {}
	if (headers['cache-control'] === CACHE_CONTROL) return false

	await new Promise<void>((resolve, reject) => {
		cos.putObjectCopy(
			{
				Bucket: bucket,
				Region: region!,
				Key: key,
				CopySource: `${bucket}.cos.${region}.myqcloud.com/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
				MetadataDirective: 'Replaced',
				Headers: {
					'Cache-Control': CACHE_CONTROL,
					'Content-Type': headers['content-type'] || 'application/octet-stream',
					'Content-Disposition': headers['content-disposition'] || 'inline',
				},
			},
			(err) => (err ? reject(err) : resolve()),
		)
	})
	return true
}

async function main() {
	for (const group of GROUPS) {
		const keys = (
			await Promise.all(group.prefixes.map((p) => listAllObjects(group.bucket!, p)))
		).flat()
		console.log(`${group.bucket} 的 ${group.prefixes.join(' + ')} 共 ${keys.length} 个对象`)

		let updated = 0
		let skipped = 0
		let failed = 0
		for (let i = 0; i < keys.length; i += CONCURRENCY) {
			const results = await Promise.allSettled(
				keys.slice(i, i + CONCURRENCY).map((k) => setCacheControl(group.bucket!, k)),
			)
			for (const r of results) {
				if (r.status === 'fulfilled') {
					r.value ? updated++ : skipped++
				} else {
					failed++
					console.error('失败:', r.reason?.message || r.reason)
				}
			}
		}
		console.log(`完成: 更新 ${updated}，跳过 ${skipped}，失败 ${failed}`)
		if (failed > 0) process.exit(1)
	}
}

main().catch((err) => {
	console.error('脚本执行失败:', err)
	process.exit(1)
})
