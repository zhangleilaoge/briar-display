import fs from 'fs'
import path from 'path'
import COS from 'cos-nodejs-sdk-v5'
import dotenv from 'dotenv'

const findRepoRoot = (startDir: string) => {
	let currentDir = startDir
	while (true) {
		if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
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
		cos.putObject(
			{
				Bucket: bucket,
				Region: region,
				Key: key,
				StorageClass: 'STANDARD',
				Body: fs.createReadStream(filePath),
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
				}
				resolve()
			},
		)
	})

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

	console.log(`Uploading ${files.length} files from ${distDir} ...`)

	for (const filePath of files) {
		const relativePath = path.relative(distDir, filePath).replace(/\\/g, '/')
		const key = `${prefix}/${relativePath}`
		await uploadFile(filePath, key)
	}

	console.log('CDN upload complete.')
}

main().catch((error) => {
	console.error('CDN upload failed:', error)
	process.exit(1)
})
