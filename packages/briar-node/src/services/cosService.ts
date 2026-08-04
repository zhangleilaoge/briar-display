import COS from 'cos-nodejs-sdk-v5'

const region = process.env.BRIAR_TX_BUCKET_REGION
const secretId = process.env.BRIAR_TX_SEC_ID
const secretKey = process.env.BRIAR_TX_SEC_KEY
const bucket = process.env.BRIAR_TX_BUCKET_NAME
const domain = process.env.BRIAR_TX_BUCKET_DOMAIN

const cos = new COS({
	SecretId: secretId || '',
	SecretKey: secretKey || '',
})

export const cosService = {
	/**
	 * Upload a buffer to COS
	 */
	async uploadBuffer(buffer: Buffer, key: string, mimeType: string): Promise<string> {
		return new Promise((resolve, reject) => {
			cos.putObject(
				{
					Bucket: bucket!,
					Region: region!,
					Key: key,
					StorageClass: 'STANDARD',
					Body: buffer,
					ContentType: mimeType,
					// 强制内联展示，避免 COS 在 GET 时按 Accept 动态注入
					// Content-Disposition: attachment 导致"新窗口打开"变成下载
					Headers: {
						'Content-Disposition': 'inline',
					},
				},
				(err, data) => {
					if (err) return reject(err)
					if (data?.statusCode === 200) {
						const url = domain
							? `${domain}/${key}`
							: `https://${bucket}.cos.${region}.myqcloud.com/${key}`
						resolve(url)
					} else {
						reject(new Error(`COS upload failed: ${data?.statusCode}`))
					}
				},
			)
		})
	},

	/**
	 * Delete an object from COS
	 */
	async deleteObject(key: string): Promise<void> {
		return new Promise((resolve, reject) => {
			cos.deleteObject(
				{
					Bucket: bucket!,
					Region: region!,
					Key: key,
				},
				(err) => {
					if (err) return reject(err)
					resolve()
				},
			)
		})
	},

	/**
	 * Get thumbnail URL using COS image processing (数据万象)
	 * Appends image processing params to the CDN URL
	 */
	getThumbnailUrl(cdnUrl: string, size = 200): string {
		// COS 数据万象图片处理：缩略图
		return `${cdnUrl}?imageMogr2/thumbnail/${size}x${size}/ignore-error/1`
	},

	/**
	 * Generate XML API authorization signature for frontend direct upload
	 * (cos-js-sdk-v5 getAuthorization callback)
	 */
	getAuth(params: {
		Method: string
		Key: string
		Query?: Record<string, string>
		Headers?: Record<string, string>
	}): string {
		return cos.getAuth({
			Method: params.Method as any,
			Key: params.Key,
			Query: params.Query || {},
			Headers: params.Headers || {},
			Expires: 900,
		})
	},

	/**
	 * Head an object, returns its size in bytes (throws if not found)
	 */
	async headObject(key: string): Promise<number> {
		return new Promise((resolve, reject) => {
			cos.headObject(
				{
					Bucket: bucket!,
					Region: region!,
					Key: key,
				},
				(err, data) => {
					if (err) return reject(err)
					resolve(Number(data?.headers?.['content-length'] || 0))
				},
			)
		})
	},

	/**
	 * Download an object as Buffer, with a hard size cap (for text preview proxy)
	 */
	async getObjectBuffer(key: string, maxBytes: number): Promise<Buffer> {
		const size = await cosService.headObject(key)
		if (size > maxBytes) {
			throw new Error(`Object too large: ${size} bytes (max ${maxBytes})`)
		}
		return new Promise((resolve, reject) => {
			cos.getObject(
				{
					Bucket: bucket!,
					Region: region!,
					Key: key,
				},
				(err, data) => {
					if (err) return reject(err)
					const body = data?.Body
					if (Buffer.isBuffer(body)) return resolve(body)
					if (body && typeof (body as NodeJS.ReadableStream).on === 'function') {
						const chunks: Buffer[] = []
						;(body as NodeJS.ReadableStream).on('data', (chunk: Buffer) => chunks.push(chunk))
						;(body as NodeJS.ReadableStream).on('end', () => resolve(Buffer.concat(chunks)))
						;(body as NodeJS.ReadableStream).on('error', reject)
						return
					}
					reject(new Error('Empty object body'))
				},
			)
		})
	},

	getPublicUrl(key: string): string {
		return domain ? `${domain}/${key}` : `https://${bucket}.cos.${region}.myqcloud.com/${key}`
	},

	getBucketInfo(): { bucket: string; region: string } {
		return { bucket: bucket || '', region: region || '' }
	},
}
