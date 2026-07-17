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
}
