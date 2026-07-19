import fs from 'fs'
import { gzipSync } from 'node:zlib'
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

// 捕获未处理的 EPIPE 等 socket 错误，防止进程崩溃
process.on('uncaughtException', (err) => {
	if (
		err &&
		typeof err === 'object' &&
		'code' in err &&
		(err as NodeJS.ErrnoException).code === 'EPIPE'
	) {
		console.warn('[uncaughtException] Suppressed EPIPE, continuing...')
		return
	}
	console.error('[uncaughtException]', err)
	process.exit(1)
})

// 每次创建新的 COS 实例，避免连接复用导致 EPIPE
const createCOS = () =>
	new COS({
		SecretId: secretId,
		SecretKey: secretKey,
		Timeout: 60000,
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

// 适合 gzip 的文本资源（压缩收益大）
const GZIP_EXTENSIONS = new Set([
	'.js',
	'.mjs',
	'.css',
	'.html',
	'.htm',
	'.svg',
	'.json',
	'.xml',
	'.txt',
	'.map',
])

// 扩展名 → Content-Type 映射
const CONTENT_TYPES: Record<string, string> = {
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.htm': 'text/html; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.json': 'application/json; charset=utf-8',
	'.xml': 'application/xml; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ico': 'image/x-icon',
}

// vite 产物带 hash 可永久缓存；HTML 走协商缓存
const buildCacheControl = (ext: string): string => {
	if (ext === '.html' || ext === '.htm') return 'public, max-age=0, must-revalidate'
	return 'public, max-age=31536000, immutable'
}

const uploadFile = (filePath: string, key: string, retries = 3): Promise<void> => {
	const rawBuffer = fs.readFileSync(filePath)
	const ext = path.extname(filePath).toLowerCase()
	const shouldGzip = GZIP_EXTENSIONS.has(ext)
	const body = shouldGzip ? gzipSync(rawBuffer) : rawBuffer
	const rawKB = (rawBuffer.length / 1024).toFixed(2)
	const sentKB = (body.length / 1024).toFixed(2)

	return new Promise<void>((resolve, reject) => {
		const cos = createCOS()

		cos.putObject(
			{
				Bucket: bucket,
				Region: region,
				Key: key,
				StorageClass: 'STANDARD',
				Body: body,
				ContentType: CONTENT_TYPES[ext] || 'application/octet-stream',
				CacheControl: buildCacheControl(ext),
				...(shouldGzip ? { ContentEncoding: 'gzip' } : {}),
			},
			(err, data) => {
				if (err) {
					console.warn(
						`Upload error for ${key} (${rawKB}KB raw, ${sentKB}KB sent):`,
						err.message || err,
					)
					if (retries > 0) {
						console.log(`Retrying ${key} (${retries} retries left) ...`)
						// 递增等待时间，给大文件更多缓冲
						const delay = 3000 + (3 - retries) * 5000
						setTimeout(() => {
							uploadFile(filePath, key, retries - 1)
								.then(resolve)
								.catch(reject)
						}, delay)
						return
					}
					reject(err)
					return
				}

				if (data?.statusCode === 200) {
					const tag = shouldGzip ? ` ${rawKB}KB→${sentKB}KB gzip` : ` ${sentKB}KB`
					console.log(`Uploaded: ${key}${tag}`)
					resolve()
				} else {
					reject(new Error(`Upload ${key} failed with status: ${data?.statusCode}`))
				}
			},
		)
	})
}

const CONCURRENCY = 3

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
