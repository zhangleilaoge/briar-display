import fs from 'node:fs'
import path from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'

const findRepoRoot = (startDir: string) => {
	let currentDir = startDir
	while (true) {
		if (fs.existsSync(path.join(currentDir, 'bun.lock'))) return currentDir
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
const publicDomain = process.env.BRIAR_TX_BUCKET_DOMAIN?.replace(/\/+$/, '')
if (!region || !secretId || !secretKey || !bucket || !publicDomain) {
	throw new Error('Missing COS environment variables')
}

const sourceDir = path.join(repoRoot, 'packages/briar-display/src/assets')
const listImages = (dir: string): string[] =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(dir, entry.name)
		if (entry.isDirectory()) return listImages(entryPath)
		return /\.(png|svg)$/i.test(entry.name) ? [entryPath] : []
	})

const files = listImages(sourceDir).map((filePath) => ({
	filePath,
	key: `static/assets/${path.relative(sourceDir, filePath).replace(/\\/g, '/')}`,
}))
const cos = new COS({ SecretId: secretId, SecretKey: secretKey, Timeout: 60000, KeepAlive: false })

const upload = (filePath: string, key: string) =>
	new Promise<void>((resolve, reject) => {
		cos.putObject(
			{
				Bucket: bucket,
				Region: region,
				Key: key,
				StorageClass: 'STANDARD',
				Body: fs.readFileSync(filePath),
				ContentType: key.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
				CacheControl: 'public, max-age=300, must-revalidate',
			},
			(error, data) => {
				if (error) reject(error)
				else if (data?.statusCode !== 200) reject(new Error(`Upload failed: ${key}`))
				else resolve()
			},
		)
	})

const verify = async (key: string) => {
	const response = await fetch(`${publicDomain}/${key}`, { method: 'HEAD' })
	if (!response.ok) throw new Error(`CDN verification failed (${response.status}): ${key}`)
}

let nextIndex = 0
const worker = async () => {
	while (nextIndex < files.length) {
		const file = files[nextIndex++]
		await upload(file.filePath, file.key)
		await verify(file.key)
	}
}

await Promise.all(Array.from({ length: Math.min(6, files.length) }, worker))
console.log(`Uploaded and verified ${files.length} images under static/assets/.`)
