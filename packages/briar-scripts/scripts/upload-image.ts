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
const domain = process.env.BRIAR_TX_BUCKET_DOMAIN
const prefix = 'images'

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

const MIME_MAP: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.bmp': 'image/bmp',
	'.ico': 'image/x-icon',
	'.avif': 'image/avif',
}

const uploadFile = (filePath: string, key: string, retries = 3): Promise<string> =>
	new Promise((resolve, reject) => {
		const ext = path.extname(filePath).toLowerCase()
		const contentType = MIME_MAP[ext] || 'application/octet-stream'

		cos.putObject(
			{
				Bucket: bucket!,
				Region: region!,
				Key: key,
				StorageClass: 'STANDARD',
				Body: fs.createReadStream(filePath),
				ContentType: contentType,
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
					const url = domain
						? `${domain}/${key}`
						: `https://${bucket}.cos.${region}.myqcloud.com/${key}`
					console.log(`Uploaded: ${key}`)
					resolve(url)
				} else {
					reject(new Error(`Upload failed with status: ${data?.statusCode}`))
				}
			},
		)
	})

const main = async () => {
	const filePaths = process.argv.slice(2)

	if (filePaths.length === 0) {
		console.error('Usage: tsx upload-image.ts <image-path> [image-path2] ...')
		console.error('Example: tsx upload-image.ts ./photo.png ./banner.jpg')
		process.exit(1)
	}

	// Validate all files exist
	for (const filePath of filePaths) {
		const resolved = path.resolve(filePath)
		if (!fs.existsSync(resolved)) {
			console.error(`File not found: ${resolved}`)
			process.exit(1)
		}
	}

	console.log(`Uploading ${filePaths.length} image(s) to COS ...`)

	const urls: string[] = []

	for (const filePath of filePaths) {
		const resolved = path.resolve(filePath)
		const filename = path.basename(resolved)
		const ext = path.extname(filename)
		const nameWithoutExt = path.basename(filename, ext)
		const timestamp = Date.now()
		const cosKey = `${prefix}/${nameWithoutExt}-${timestamp}${ext}`

		const url = await uploadFile(resolved, cosKey)
		urls.push(url)
	}

	console.log('\n--- Upload Results ---')
	for (const url of urls) {
		console.log(url)
	}
}

main().catch((error) => {
	console.error('Image upload failed:', error)
	process.exit(1)
})
