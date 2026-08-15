import fs from 'fs'
import path from 'path'
import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'

/**
 * 一次性迁移：把公开桶 files/ 与 images/（图床时代遗留前缀，DB 里仍有
 * filename 以 images/ 开头的记录）下的所有对象（含视频封面 .cover.jpg）
 * 拷贝到私有读桶，key 保持不变。幂等可重跑（目标已存在且大小一致则跳过），
 * 不删除源桶对象，验证无误后由人工清理。
 * 用法：bun run --filter @briar/scripts cos:migrate-files
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
const srcBucket = process.env.BRIAR_TX_BUCKET_NAME
const dstBucket = process.env.BRIAR_TX_PRIVATE_BUCKET_NAME

if (!region || !secretId || !secretKey || !srcBucket || !dstBucket) {
	console.error(
		'Missing COS env vars. Required: BRIAR_TX_BUCKET_REGION, BRIAR_TX_SEC_ID, BRIAR_TX_SEC_KEY, BRIAR_TX_BUCKET_NAME, BRIAR_TX_PRIVATE_BUCKET_NAME',
	)
	process.exit(1)
}

if (srcBucket === dstBucket) {
	console.error('源桶与目标桶相同，无需迁移')
	process.exit(1)
}

const cos = new COS({
	SecretId: secretId,
	SecretKey: secretKey,
})

const CONCURRENCY = 5

interface CosObject {
	Key: string
	Size: string
}

/** 需要迁移的前缀：files/ 为现行前缀，images/ 为图床时代遗留前缀 */
const PREFIXES = ['files/', 'images/']

/** 分页列出源桶指定前缀下全部对象 */
async function listAllObjects(prefix: string): Promise<CosObject[]> {
	const all: CosObject[] = []
	let marker: string | undefined
	while (true) {
		const data = await new Promise<COS.GetBucketResult>((resolve, reject) => {
			cos.getBucket(
				{
					Bucket: srcBucket!,
					Region: region!,
					Prefix: prefix,
					Marker: marker,
					MaxKeys: 1000,
				},
				(err, data) => (err ? reject(err) : resolve(data)),
			)
		})
		all.push(...(data.Contents || []))
		if (data.IsTruncated !== 'true') break
		marker = data.NextMarker || all[all.length - 1]?.Key
		if (!marker) break
	}
	return all
}

/** 目标桶已有同大小对象则跳过 */
async function isUpToDate(key: string, size: number): Promise<boolean> {
	try {
		const data = await new Promise<COS.HeadObjectResult>((resolve, reject) => {
			cos.headObject({ Bucket: dstBucket!, Region: region!, Key: key }, (err, data) =>
				err ? reject(err) : resolve(data),
			)
		})
		return Number(data?.headers?.['content-length'] || 0) === size
	} catch {
		return false
	}
}

async function copyObject(obj: CosObject): Promise<'copied' | 'skipped'> {
	const size = Number(obj.Size)
	if (await isUpToDate(obj.Key, size)) return 'skipped'
	await new Promise<void>((resolve, reject) => {
		cos.putObjectCopy(
			{
				Bucket: dstBucket!,
				Region: region!,
				Key: obj.Key,
				CopySource: `${srcBucket}.cos.${region}.myqcloud.com/${encodeURIComponent(obj.Key)}`,
			},
			(err) => (err ? reject(err) : resolve()),
		)
	})
	return 'copied'
}

async function main() {
	const objects = (await Promise.all(PREFIXES.map(listAllObjects))).flat()
	console.log(
		`源桶 ${PREFIXES.join(' + ')} 共 ${objects.length} 个对象，开始迁移到 ${dstBucket} ...`,
	)

	let copied = 0
	let skipped = 0
	let failed = 0
	for (let i = 0; i < objects.length; i += CONCURRENCY) {
		const batch = objects.slice(i, i + CONCURRENCY)
		const results = await Promise.allSettled(batch.map(copyObject))
		for (const r of results) {
			if (r.status === 'fulfilled') {
				r.value === 'copied' ? copied++ : skipped++
			} else {
				failed++
				console.error('拷贝失败:', r.reason)
			}
		}
		console.log(`进度: ${Math.min(i + CONCURRENCY, objects.length)}/${objects.length}`)
	}

	console.log(`迁移完成: 拷贝 ${copied}，跳过 ${skipped}，失败 ${failed}`)
	if (failed > 0) process.exit(1)
}

main().catch((err) => {
	console.error('迁移失败:', err)
	process.exit(1)
})
