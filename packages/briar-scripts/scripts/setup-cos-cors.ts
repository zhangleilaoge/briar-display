import fs from 'fs'
import path from 'path'
import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'

/**
 * 一次性配置 COS bucket CORS，支持前端 cos-js-sdk-v5 分片直传。
 * 用法：make cos-cors（或 bun run --filter @briar/scripts cos:cors）
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
})

cos.putBucketCors(
	{
		Bucket: bucket,
		Region: region,
		CORSRules: [
			{
				AllowedOrigins: ['https://stardew.site', 'http://localhost:4321', 'http://127.0.0.1:4321'],
				AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
				AllowedHeaders: ['*'],
				ExposeHeaders: ['ETag', 'x-cos-request-id'],
				MaxAgeSeconds: 600,
			},
		],
	},
	(err) => {
		if (err) {
			console.error('配置 CORS 失败:', err)
			process.exit(1)
		}
		console.log('✅ COS bucket CORS 配置完成')
	},
)
