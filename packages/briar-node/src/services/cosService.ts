import COS from 'cos-nodejs-sdk-v5'

const region = process.env.BRIAR_TX_BUCKET_REGION
const secretId = process.env.BRIAR_TX_SEC_ID
const secretKey = process.env.BRIAR_TX_SEC_KEY
// 公开读 bucket：前端静态资源、头像等公开资源
const publicBucket = process.env.BRIAR_TX_BUCKET_NAME
const publicDomain = process.env.BRIAR_TX_BUCKET_DOMAIN
// 私有读 bucket：用户文件（files/ 前缀），访问一律走签名 URL
const bucket = process.env.BRIAR_TX_PRIVATE_BUCKET_NAME

/** 签名 URL 有效期（秒），覆盖长页面停留场景 */
const SIGNED_URL_EXPIRES = 6 * 3600

/** 签名结果缓存（key+query → url），进程内有效，保证窗口期内 URL 稳定 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

if (!bucket) {
	console.error('[COS] 缺少 BRIAR_TX_PRIVATE_BUCKET_NAME，文件功能将不可用')
}

const cos = new COS({
	SecretId: secretId || '',
	SecretKey: secretKey || '',
})

export const cosService = {
	/**
	 * Upload a buffer to the public bucket（头像等公开读资源）。
	 * key 每次生成都带 uuid（内容不可变），放心给一个月浏览器缓存。
	 */
	async uploadBuffer(buffer: Buffer, key: string, mimeType: string): Promise<string> {
		return new Promise((resolve, reject) => {
			cos.putObject(
				{
					Bucket: publicBucket!,
					Region: region!,
					Key: key,
					StorageClass: 'STANDARD',
					Body: buffer,
					ContentType: mimeType,
					CacheControl: 'max-age=2592000',
					// 强制内联展示，避免 COS 在 GET 时按 Accept 动态注入
					// Content-Disposition: attachment 导致"新窗口打开"变成下载
					Headers: {
						'Content-Disposition': 'inline',
					},
				},
				(err, data) => {
					if (err) return reject(err)
					if (data?.statusCode === 200) {
						const url = publicDomain
							? `${publicDomain}/${key}`
							: `https://${publicBucket}.cos.${region}.myqcloud.com/${key}`
						resolve(url)
					} else {
						reject(new Error(`COS upload failed: ${data?.statusCode}`))
					}
				},
			)
		})
	},

	/**
	 * Delete an object from the public bucket（如旧头像）
	 */
	async deletePublicObject(key: string): Promise<void> {
		return new Promise((resolve, reject) => {
			cos.deleteObject(
				{
					Bucket: publicBucket!,
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
	 * Delete an object from COS（私有 bucket 内的用户文件）
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

	/** 视频封面图的 COS key 约定：{原 key 去扩展名}.cover.jpg（与前端上传约定一致） */
	getCoverKey(key: string): string {
		return `${key.replace(/\.[a-z0-9]+$/i, '')}.cover.jpg`
	},

	/** 删除文件对象（视频会连带封面图，best effort，不抛错） */
	async deleteFileWithCover(key: string, mimeType: string): Promise<void> {
		try {
			await cosService.deleteObject(key)
		} catch (err) {
			console.error('COS delete failed:', err)
		}
		if (mimeType.startsWith('video/')) {
			try {
				await cosService.deleteObject(cosService.getCoverKey(key))
			} catch {
				/* 封面可能不存在，忽略 */
			}
		}
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

	/**
	 * 私有 bucket 的对象裸 URL（无签名，不可直接访问）。
	 * 仅用于写库留存（cdn_url 字段）；对外输出一律走 getSignedUrl / signFileUrls。
	 */
	getPublicUrl(key: string): string {
		return `https://${bucket}.cos.${region}.myqcloud.com/${key}`
	},

	/**
	 * 生成私有 bucket 对象的签名 URL（有效期 SIGNED_URL_EXPIRES）。
	 * 静态密钥下 getObjectUrl 同步返回字符串。
	 * 结果按 key+query 缓存至过期前 10 分钟：浏览器缓存以完整 URL 为 key，
	 * 每次重新签名会导致缓存失效，缓存签名结果可保证窗口期内 URL 稳定。
	 */
	getSignedUrl(key: string, query?: Record<string, string>): string {
		const cacheKey = query ? `${key}?${JSON.stringify(query)}` : key
		const hit = signedUrlCache.get(cacheKey)
		if (hit && hit.expiresAt > Date.now()) return hit.url

		const ret = cos.getObjectUrl({
			Bucket: bucket!,
			Region: region!,
			Key: key,
			Sign: true,
			Expires: SIGNED_URL_EXPIRES,
			Query: query,
		}) as unknown
		let url = typeof ret === 'string' ? ret : (ret as { Url: string }).Url
		// SDK 同步返回路径漏了数据万象参数的 q-url-param-list 二次编码（仅异步回调路径有），
		// 不修复带 Query 的签名 URL 会报 SignatureDoesNotMatch
		const m = url.match(/q-url-param-list.*?(?=&)/g)
		if (m) {
			url = url.replace(
				new RegExp(m[0], 'g'),
				`q-url-param-list=${encodeURIComponent(m[0].replace('q-url-param-list=', '')).toLowerCase()}`,
			)
		}
		signedUrlCache.set(cacheKey, {
			url,
			expiresAt: Date.now() + (SIGNED_URL_EXPIRES - 600) * 1000,
		})
		return url
	},

	/** 图片缩略图签名 URL（数据万象 imageMogr2 参数纳入签名） */
	getSignedThumbnailUrl(key: string, size = 200): string {
		return cosService.getSignedUrl(key, {
			[`imageMogr2/thumbnail/${size}x${size}/ignore-error/1`]: '',
		})
	},

	/**
	 * 为文件记录生成带签名的访问 URL（读取时现算，忽略 DB 留存的裸 URL）。
	 * 图片：cdnUrl 原图签名 + thumbnailUrl 缩略图签名；
	 * 视频：有封面签封面，无封面 thumbnailUrl 为 null（前端 video 首帧兜底）。
	 */
	signFileUrls(file: { filename: string; mimeType: string; thumbnailUrl: string | null }): {
		cdnUrl: string
		thumbnailUrl: string | null
	} {
		return {
			cdnUrl: cosService.getSignedUrl(file.filename),
			thumbnailUrl: file.mimeType.startsWith('image/')
				? cosService.getSignedThumbnailUrl(file.filename)
				: file.thumbnailUrl
					? cosService.getSignedUrl(cosService.getCoverKey(file.filename))
					: null,
		}
	},

	getBucketInfo(): { bucket: string; region: string } {
		return { bucket: bucket || '', region: region || '' }
	},
}
