import fs from 'fs'
import path from 'path'
import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'

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
const prefix = 'static'.replace(/^\/+/, '').replace(/\/+$/, '')

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
	// 默认 KeepAlive: true 会复用连接，COS 服务端关闭连接后本地仍可能继续写入，
	// 触发 TLSSocket EPIPE 且 request 库未监听该 socket error，导致进程崩溃。
	KeepAlive: false,
})

const listFiles = (dir: string): string[] => {
	const entries = fs.readdirSync(dir, { withFileTypes: true })
	const files: string[] = []

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			files.push(...listFiles(entryPath))
		} else {
			files.push(entryPath)
		}
	}

	return files
}

const uploadFile = (filePath: string, key: string, retries = 3) =>
	new Promise<void>((resolve, reject) => {
		const fileBuffer = fs.readFileSync(filePath)
		cos.putObject(
			{
				Bucket: bucket,
				Region: region,
				Key: key,
				StorageClass: 'STANDARD',
				Body: fileBuffer,
			},
			(err, data) => {
				if (err) {
					if (retries > 0) {
						console.log(`Retrying ${filePath} (${retries} retries left) ...`)
						setTimeout(() => {
							uploadFile(filePath, key, retries - 1)
								.then(resolve)
								.catch(reject)
						}, 3000)
						return
					}
					reject(err)
					return
				}

				if (data?.statusCode === 200) {
					console.log(`Uploaded: ${key}`)
					resolve()
				} else {
					reject(new Error(`Upload ${key} failed with status: ${data?.statusCode}`))
				}
			},
		)
	})

const CONCURRENCY = 5

const main = async () => {
	const distDir = path.join(repoRoot, 'packages/briar-display/dist')

	if (!fs.existsSync(distDir)) {
		console.error(`Missing dist directory: ${distDir}`)
		process.exit(1)
	}

	const files = listFiles(distDir)
	if (files.length === 0) {
		console.log('No files to upload.')
		return
	}

	console.log(`Uploading ${files.length} files from ${distDir} (concurrency: ${CONCURRENCY}) ...`)

	const tasks = files.map((filePath) => {
		const relativePath = path.relative(distDir, filePath).replace(/\\/g, '/')
		const key = `${prefix}/${relativePath}`
		return () => uploadFile(filePath, key)
	})

	// Run uploads with limited concurrency
	const results: Promise<void>[] = []
	let index = 0
	const runNext = (): Promise<void> => {
		if (index >= tasks.length) return Promise.resolve()
		const task = tasks[index++]
		return task().then(() => runNext())
	}
	for (let i = 0; i < Math.min(CONCURRENCY, tasks.length); i++) {
		results.push(runNext())
	}
	await Promise.all(results)

	console.log('CDN upload complete.')
}

main().catch((error) => {
	console.error('CDN upload failed:', error)
	process.exit(1)
})
