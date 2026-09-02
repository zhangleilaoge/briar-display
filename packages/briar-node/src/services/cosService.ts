import COS from 'cos-nodejs-sdk-v5'

const region = process.env.BRIAR_TX_BUCKET_REGION
const secretId = process.env.BRIAR_TX_SEC_ID
const secretKey = process.env.BRIAR_TX_SEC_KEY
// 公开读 bucket：前端静态资源、头像等公开资源
const publicBucket = process.env.BRIAR_TX_BUCKET_NAME
const publicDomain = process.env.BRIAR_TX_BUCKET_DOMAIN
// 私有读 bucket：用户文件（files/ 前缀），访问一律走签名 URL
const bucket = process.env.BRIAR_TX_PRIVATE_BUCKET_NAME

/**
 * KeyTime 对齐窗口（秒）。签名起点取整到固定窗口边界：
 * 同一窗口内任何时刻（含 PM2 重启后）签出的 URL 完全一致，浏览器缓存可跨部署存活；
 * 窗口边界自然轮换，签发时最短有效期 = SIGNED_URL_EXPIRES - KEYTIME_WINDOW。
 */
const KEYTIME_WINDOW = 7 * 24 * 3600

/** 签名 URL 有效期（秒），必须覆盖 KEYTIME_WINDOW + 期望的最短剩余有效期（当前 = 7 天窗口 + 1 天兜底） */
const SIGNED_URL_EXPIRES = KEYTIME_WINDOW + 24 * 3600

/** 签名结果缓存（key+query → url），进程内有效，仅用于避免重复计算 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

/** 与 SDK 内部一致的 camSafeUrlEncode（encodeURIComponent 补强 5 个字符） */
function camSafeUrlEncode(str: string): string {
	return encodeURIComponent(str)
		.replace(/!/g, '%21')
		.replace(/'/g, '%27')
		.replace(/\(/g, '%28')
		.replace(/\)/g, '%29')
		.replace(/\*/g, '%2A')
}

/** 与 SDK 内部 obj2str 一致：key 按小写排序后 key=val 拼接（URL 中对象参数部分的构造规则） */
function obj2str(obj: Record<string, string>): string {
	return Object.keys(obj)
		.sort((a, b) => {
			const la = a.toLowerCase()
			const lb = b.toLowerCase()
			return la === lb ? 0 : la > lb ? 1 : -1
		})
		.map((k) => `${camSafeUrlEncode(k)}=${camSafeUrlEncode(obj[k] ?? '')}`)
		.join('&')
}

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
						resolve(cosService.getPublicBucketUrl(key))
					} else {
						reject(new Error(`COS upload failed: ${data?.statusCode}`))
					}
				},
			)
		})
	},

	/** 公有 bucket 对象裸 URL（公有读，可直接访问；key 可能含中文文件名，按段编码） */
	getPublicBucketUrl(key: string): string {
		const encoded = key.split('/').map(encodeURIComponent).join('/')
		return publicDomain
			? `${publicDomain}/${encoded}`
			: `https://${publicBucket}.cos.${region}.myqcloud.com/${encoded}`
	},

	/**
	 * Stream upload to the public bucket（媒体解析缓存：proxy miss 时边回客户端边传 COS）。
	 * 对象内容按源 URL 哈希定名、不可变，给一个月浏览器缓存。
	 */
	async uploadStream(
		stream: NodeJS.ReadableStream,
		key: string,
		mimeType: string,
		contentLength?: number,
	): Promise<string> {
		return new Promise((resolve, reject) => {
			cos.putObject(
				{
					Bucket: publicBucket!,
					Region: region!,
					Key: key,
					StorageClass: 'STANDARD',
					Body: stream as any, // SDK 的 UploadBody 类型未涵盖通用 ReadableStream，运行时支持 pipe 流
					ContentType: mimeType,
					ContentLength: contentLength,
					CacheControl: 'max-age=2592000',
					Headers: {
						'Content-Disposition': 'inline',
					},
				},
				(err, data) => {
					if (err) return reject(err)
					if (data?.statusCode === 200) {
						resolve(cosService.getPublicBucketUrl(key))
					} else {
						reject(new Error(`COS upload failed: ${data?.statusCode}`))
					}
				},
			)
		})
	},

	/**
	 * Delete an object from the public bucket（如旧头像、过期的媒体缓存）
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
	 * KeyTime 按 KEYTIME_WINDOW 对齐，同一窗口内（含重启后）URL 稳定，浏览器缓存可跨部署存活。
	 * 结果按 key+query 缓存至过期前 10 分钟，仅用于避免重复计算签名。
	 */
	getSignedUrl(key: string, query?: Record<string, string>): string {
		const cacheKey = query ? `${key}?${JSON.stringify(query)}` : key
		const hit = signedUrlCache.get(cacheKey)
		if (hit && hit.expiresAt > Date.now()) return hit.url

		const windowStart = Math.floor(Date.now() / 1000 / KEYTIME_WINDOW) * KEYTIME_WINDOW
		const expiresAtSec = windowStart + SIGNED_URL_EXPIRES
		// 静态密钥下同步返回 Authorization 字符串；URL 构造与 SDK getObjectUrl 同步路径一致：
		// baseUrl?Authorization&obj2str(query)
		let auth = COS.getAuthorization({
			SecretId: secretId || '',
			SecretKey: secretKey || '',
			Bucket: bucket!,
			Region: region!,
			Method: 'get',
			Key: key,
			Query: query,
			Expires: SIGNED_URL_EXPIRES,
			KeyTime: `${windowStart};${expiresAtSec}`,
		})
		// SDK 同步返回路径漏了数据万象参数的 q-url-param-list 二次编码（仅异步回调路径有），
		// 不修复带 Query 的签名 URL 会报 SignatureDoesNotMatch
		const m = auth.match(/q-url-param-list.*?(?=&)/g)
		if (m) {
			auth = auth.replace(
				new RegExp(m[0], 'g'),
				`q-url-param-list=${encodeURIComponent(m[0].replace('q-url-param-list=', '')).toLowerCase()}`,
			)
		}
		let url = `${cosService.getPublicUrl(key)}?${auth}`
		if (query) url += `&${obj2str(query)}`
		signedUrlCache.set(cacheKey, { url, expiresAt: (expiresAtSec - 600) * 1000 })
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
