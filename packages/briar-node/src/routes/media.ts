import { PassThrough, Readable } from 'node:stream'
import type { ApiResponse, MediaParseResult } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { authService } from '../services/authService'
import { cosService } from '../services/cosService'
import {
	MEDIA_CACHE_MAX_RECORD_BYTES,
	hashMediaUrl,
	mediaCacheService,
} from '../services/mediaCacheService'
import { permissionService } from '../services/permissionService'
import { getWechatCookieHeader, parseWechatArticle } from '../services/wechatMediaService'

const mediaRoutes = new Hono()

/** 解析上游（逆向自 catsapi.com/labs/media-parser） */
const PARSE_API_URL = 'https://catsapi.com/api/labs/media-parser/parse'
// 上游首解析偶发极慢（实测 douyin 图文长达 ~55s），卡到 85s（前端 axios 90s 兜底）
const PARSE_TIMEOUT_MS = 85_000
const PROXY_TIMEOUT_MS = 120_000
const MAX_INPUT_LENGTH = 2000
/** 限频：parse 每 IP 每分钟 6 次；proxy 宽松些（视频 Range 流式 + 批量下载有突发） */
const PARSE_RATE_LIMIT = 6
const PROXY_RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000

const UPSTREAM_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 下载代理域名白名单（防止被当成开放代理）：小红书 CDN + 微信图床/视频 CDN + 抖音 CDN */
const ALLOWED_PROXY_HOST_SUFFIXES = [
	'.xhscdn.com',
	'.xiaohongshu.com',
	'.qpic.cn',
	'.tc.qq.com',
	'.douyin.com',
	'.douyinpic.com',
	'.douyinvod.com',
	'.douyinstatic.com',
	'.zjcdn.com',
	'.snssdk.com',
	// X/Twitter 媒体 CDN（video.twimg.com / pbs.twimg.com，国内不可达，仅海外环境代理可用）
	'.twimg.com',
]

/** 各平台 CDN 对应的 Referer */
const PLATFORM_REFERERS: [string, string][] = [
	['.xhscdn.com', 'https://www.xiaohongshu.com/'],
	['.xiaohongshu.com', 'https://www.xiaohongshu.com/'],
	['.douyin.com', 'https://www.douyin.com/'],
	['.douyinpic.com', 'https://www.douyin.com/'],
	['.douyinvod.com', 'https://www.douyin.com/'],
	['.douyinstatic.com', 'https://www.douyin.com/'],
	['.zjcdn.com', 'https://www.douyin.com/'],
	['.snssdk.com', 'https://www.douyin.com/'],
	['.twimg.com', 'https://x.com/'],
]

function refererFor(host: string): string {
	for (const [suffix, referer] of PLATFORM_REFERERS) {
		if (host.endsWith(suffix)) return referer
	}
	return 'https://mp.weixin.qq.com/'
}

type AuthedUser = { id: string }

/** 可选登录态：媒体解析免登录，但登录用户仍需识别（超管豁免限频） */
async function resolveOptionalUser(c: Context): Promise<AuthedUser | null> {
	const existing = c.get('user') as AuthedUser | undefined
	if (existing) return existing
	const token =
		c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || getCookie(c, 'briar_token')
	if (!token) return null
	try {
		const payload = authService.verifyToken(token)
		return { id: payload.sub }
	} catch {
		return null
	}
}

/** 滑动窗口限频（模块级，进程内有效），key 已含 scope 前缀 */
const rateBuckets = new Map<string, number[]>()

function hitRateLimit(key: string, limit: number): boolean {
	const now = Date.now()
	// 兜底清理，避免 map 无限增长
	if (rateBuckets.size > 5000) {
		for (const [k, list] of rateBuckets) {
			const alive = list.filter((t) => now - t < RATE_WINDOW_MS)
			if (alive.length === 0) rateBuckets.delete(k)
			else rateBuckets.set(k, alive)
		}
	}
	const list = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS)
	if (list.length >= limit) {
		rateBuckets.set(key, list)
		return true
	}
	list.push(now)
	rateBuckets.set(key, list)
	return false
}

/** 取客户端 IP（限频/匿名缓存 key 用） */
function clientIp(c: Context): string {
	return (
		(c.req.header('x-forwarded-for') || '').split(',')[0].trim() ||
		c.req.header('x-real-ip') ||
		'unknown'
	)
}

/** 超管豁免限频；其余按 IP 计数 */
async function isRateLimited(
	c: Context,
	user: AuthedUser | null,
	scope: 'parse' | 'proxy',
	limit: number,
): Promise<boolean> {
	if (user && (await permissionService.isAdmin(user.id))) return false
	return hitRateLimit(`${scope}:${clientIp(c)}`, limit)
}

function tooManyRequests(c: Context) {
	return c.json<ApiResponse>(
		{ success: false, message: '操作太频繁，请稍后再试' },
		HTTP_STATUS.TOO_MANY_REQUESTS,
	)
}

/** 从分享文案中提取第一个 URL */
function extractUrl(text: string): string | null {
	const match = text.match(/https?:\/\/[^\s]+/)
	return match ? match[0] : null
}

/** 缓存隔离键：登录按 userId，未登录按 IP */
function personKey(c: Context, user: AuthedUser | null): string {
	return user ? `u:${user.id}` : `ip:${clientIp(c)}`
}

function getHostname(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase()
	} catch {
		return null
	}
}

/** 识别支持的平台：小红书/抖音（含短链）走 catsapi，公众号文章走自研解析，X 走 fxtwitter */
function detectPlatform(url: string): 'xhs' | 'wechat' | 'douyin' | 'x' | null {
	const host = getHostname(url)
	if (!host) return null
	if (
		host === 'xiaohongshu.com' ||
		host.endsWith('.xiaohongshu.com') ||
		// 短链域名 .com/.cn 都在用（App 分享文案现多为 xhslink.cn）
		host === 'xhslink.com' ||
		host.endsWith('.xhslink.com') ||
		host === 'xhslink.cn' ||
		host.endsWith('.xhslink.cn')
	) {
		return 'xhs'
	}
	if (host === 'douyin.com' || host.endsWith('.douyin.com') || host.endsWith('.iesdouyin.com')) {
		return 'douyin'
	}
	if (host === 'mp.weixin.qq.com') return 'wechat'
	if (
		host === 'x.com' ||
		host.endsWith('.x.com') ||
		host === 'twitter.com' ||
		host.endsWith('.twitter.com')
	) {
		return 'x'
	}
	return null
}

/** X/Twitter：catsapi 不支持（502），走 fxtwitter 公共代理（免登录、支持 NSFW 推文） */
const FX_API_BASE = 'https://api.fxtwitter.com/i/status/'
const TWEET_ID_RE = /\/status(?:es)?\/(\d{5,25})/

interface FxMediaItem {
	url: string
	thumbnail_url?: string
	type?: string // photo / video / gif
}

/** fxtwitter 响应 → 通用解析结果；图片/视频 CDN（twimg）公开可直连，无签名时效问题 */
async function parseTweet(url: string): Promise<MediaParseResult> {
	const id = url.match(TWEET_ID_RE)?.[1]
	if (!id) throw new Error('无效的推文链接')
	const res = await fetch(`${FX_API_BASE}${id}`, {
		headers: { 'User-Agent': UPSTREAM_UA },
		signal: AbortSignal.timeout(30_000),
	})
	if (!res.ok) throw new Error(`解析失败（HTTP ${res.status}）`)
	const json = (await res.json()) as {
		code?: number
		message?: string
		tweet?: {
			text?: string
			author?: { name?: string; screen_name?: string }
			media?: { all?: FxMediaItem[] }
		}
	}
	if (json.code !== 200 || !json.tweet) {
		throw new Error(json.message || '推文不存在或已被删除')
	}
	const media = json.tweet.media?.all || []
	const videos = media.filter((m) => m.type === 'video' || m.type === 'gif').map((m) => m.url)
	const images = media.filter((m) => m.type === 'photo').map((m) => m.url)
	const cover =
		media.find((m) => m.type === 'video' || m.type === 'gif')?.thumbnail_url || images[0] || null
	return {
		platform: 'x',
		title: json.tweet.text || '',
		author: json.tweet.author
			? {
					name: json.tweet.author.name || '',
					uid: json.tweet.author.screen_name,
				}
			: null,
		cover,
		video_url: videos[0] || null,
		audio_url: null,
		videos,
		images,
		live_photos: [],
	}
}

function isAllowedProxyUrl(url: string): boolean {
	const host = getHostname(url)
	if (!host) return false
	return ALLOWED_PROXY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** POST /parse — 解析分享链接，返回无水印媒体地址（免登录，IP 限频；命中缓存不占限频） */
mediaRoutes.post('/parse', async (c) => {
	const user = await resolveOptionalUser(c)
	const person = personKey(c, user)

	const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string })
	const input = (body.url || '').trim()
	if (!input || input.length > MAX_INPUT_LENGTH) {
		return c.json<ApiResponse>(
			{ success: false, message: '请粘贴分享链接或分享文案' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const url = extractUrl(input)
	const platform = url ? detectPlatform(url) : null
	if (!url || !platform) {
		return c.json<ApiResponse>(
			{ success: false, message: '目前支持小红书、抖音、微信公众号、X(Twitter) 链接' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	// 命中本人缓存直接返回（X-Cache 便于排查），不消耗限频；缓存故障不阻塞正常解析
	const cached = await mediaCacheService.getCachedParse(person, url).catch(() => null)
	if (cached) {
		c.header('X-Cache', 'hit')
		return c.json<ApiResponse<MediaParseResult>>({ success: true, data: cached })
	}

	if (await isRateLimited(c, user, 'parse', PARSE_RATE_LIMIT)) return tooManyRequests(c)

	/** 解析成功后写缓存（含 10 条 LRU 淘汰），失败只记日志 */
	const saveCache = (data: MediaParseResult) =>
		mediaCacheService
			.saveCachedParse(person, url, platform, data)
			.catch((err) => console.error('[MediaCache] 解析缓存写入失败:', err))

	// 公众号文章走自研解析（wechatMediaService），X 走 fxtwitter，其余转发 catsapi
	if (platform === 'wechat') {
		try {
			const data = await parseWechatArticle(url)
			if (data.images.length === 0 && data.videos.length === 0 && data.live_photos.length === 0) {
				return c.json<ApiResponse>(
					{ success: false, message: '未解析到可下载的媒体' },
					HTTP_STATUS.INTERNAL_SERVER_ERROR,
				)
			}
			await saveCache(data)
			c.header('X-Cache', 'miss')
			return c.json<ApiResponse<MediaParseResult>>({ success: true, data })
		} catch (err) {
			console.error('Wechat article parse failed:', err)
			const message = err instanceof Error ? err.message : '解析失败，请稍后重试'
			return c.json<ApiResponse>({ success: false, message }, HTTP_STATUS.INTERNAL_SERVER_ERROR)
		}
	}

	if (platform === 'x') {
		try {
			const data = await parseTweet(url)
			if (data.images.length === 0 && data.videos.length === 0) {
				return c.json<ApiResponse>(
					{ success: false, message: '未解析到可下载的媒体' },
					HTTP_STATUS.INTERNAL_SERVER_ERROR,
				)
			}
			await saveCache(data)
			c.header('X-Cache', 'miss')
			return c.json<ApiResponse<MediaParseResult>>({ success: true, data })
		} catch (err) {
			console.error('Tweet parse failed:', err)
			const message = err instanceof Error ? err.message : '解析失败，请稍后重试'
			return c.json<ApiResponse>({ success: false, message }, HTTP_STATUS.INTERNAL_SERVER_ERROR)
		}
	}

	try {
		const upstream = await fetch(PARSE_API_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'User-Agent': UPSTREAM_UA },
			body: JSON.stringify({ url }),
			signal: AbortSignal.timeout(PARSE_TIMEOUT_MS),
		})
		if (!upstream.ok) {
			const detail = await upstream
				.json()
				.then((d) => (d as { detail?: string })?.detail)
				.catch(() => null)
			return c.json<ApiResponse>(
				{ success: false, message: detail || `解析失败（HTTP ${upstream.status}）` },
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
		const data = (await upstream.json()) as MediaParseResult
		await saveCache(data)
		c.header('X-Cache', 'miss')
		return c.json<ApiResponse<MediaParseResult>>({ success: true, data })
	} catch (err) {
		console.error('Media parse failed:', err)
		const message =
			err instanceof Error && err.name === 'TimeoutError'
				? '解析超时，请重试'
				: '解析失败，请稍后重试'
		return c.json<ApiResponse>({ success: false, message }, HTTP_STATUS.INTERNAL_SERVER_ERROR)
	}
})

/** 缓存对象 key 的扩展名：优先取 URL 里的，取不到按 MIME 映射 */
const EXT_BY_MIME: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'audio/mpeg': 'mp3',
	'audio/mp4': 'm4a',
	'audio/x-m4a': 'm4a',
}

function extForCacheKey(url: string, contentType: string): string {
	const m = url.match(/\.(mp4|mov|jpg|jpeg|png|webp|gif|mp3|m4a)(?:[?/!]|$)/i)
	if (m) return m[1].toLowerCase().replace('jpeg', 'jpg')
	const mime = contentType.split(';')[0].trim().toLowerCase()
	return EXT_BY_MIME[mime] || 'bin'
}

/**
 * GET /proxy?url=...&name=...&inline=1&from=... — 媒体代理（解决 CDN 防盗链/跨域，免登录，IP 限频）
 * 默认附件形式返回（下载）；inline=1 时仅带建议文件名（<video>/<img> 预览用）
 * 旁路缓存：miss 时拉全量、边回客户端边传 COS 公有桶（同 URL 哈希去重）；
 * hit 时 302 直发公有桶 URL，服务器不再转发。from 为来源解析链接，用于随记录淘汰连带清理。
 * 每条解析记录累计缓存 ≤ 50MB，超过则该记录完全不走媒体缓存。
 */
mediaRoutes.get('/proxy', async (c) => {
	const user = await resolveOptionalUser(c)
	if (await isRateLimited(c, user, 'proxy', PROXY_RATE_LIMIT)) return tooManyRequests(c)

	// 小红书 CDN 多为 http 链接，服务端统一直连 https
	const url = (c.req.query('url') || '').replace(/^http:\/\//i, 'https://')
	if (!url || !isAllowedProxyUrl(url)) {
		return c.json<ApiResponse>(
			{ success: false, message: '不支持的媒体地址' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const inline = c.req.query('inline') === '1'
	const hasName = Boolean(c.req.query('name'))
	const rawName = (c.req.query('name') || 'media').replace(/[^\w.一-龥-]+/g, '_').slice(-120)
	const from = (c.req.query('from') || '').slice(0, 512)
	const person = personKey(c, user)
	const urlHash = hashMediaUrl(url)
	const disposition = (type: 'inline' | 'attachment') =>
		`${type}; filename*=UTF-8''${encodeURIComponent(rawName)}`

	// 命中 COS 旁路缓存 → 302 直发。
	// 注意匿名 GET 不支持 response-content-disposition（400 InvalidRequest），
	// 下载文件名靠对象 key 末段携带（见下方 cosKey 命名）
	const cached = await mediaCacheService.lookupMedia(person, urlHash).catch(() => null)
	if (cached) {
		return c.redirect(cosService.getPublicBucketUrl(cached.cosKey), 302)
	}

	try {
		// 按平台 CDN 带对应 Referer（实测大多不带也可，兜底防盗链）
		const host = getHostname(url) || ''
		const referer = refererFor(host)
		const reqHeaders: Record<string, string> = { 'User-Agent': UPSTREAM_UA, Referer: referer }
		// 实况图（bcvideo.qpic.cn）的 auth 参数绑定文章页下发的 Cookie，需回带否则 403
		if (host.endsWith('.qpic.cn')) {
			const cookie = getWechatCookieHeader()
			if (cookie) reqHeaders.Cookie = cookie
		}
		// 预览带 Range（视频预加载/拖进度）：只拉客户端要的分段、纯透传不写缓存；
		// 不带 Range 的 inline（<img> 全量加载）与下载一样落缓存——完整消费才配进缓存
		const range = c.req.header('range')
		if (inline && range) reqHeaders.Range = range
		// undici 偶发 "fetch failed"（连接池/网络抖动、CDN 边缘节点抽风），最多重试 3 次
		let upstream: Response | null = null
		let lastErr: unknown = null
		for (let attempt = 0; attempt < 3 && !upstream; attempt++) {
			try {
				upstream = await fetch(url, {
					headers: reqHeaders,
					signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
					redirect: 'follow',
				})
			} catch (err) {
				lastErr = err
				if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
			}
		}
		if (!upstream) throw lastErr
		if (upstream.status === 403) {
			// 签名 URL 过期：删掉对应解析缓存，让「重新解析」真正重新拉取新签名
			if (from) mediaCacheService.removeCachedParse(person, from).catch(() => {})
			return c.json<ApiResponse>(
				{ success: false, message: '链接已过期，请重新解析' },
				HTTP_STATUS.FORBIDDEN,
			)
		}
		if (!upstream.ok || !upstream.body) {
			return c.json<ApiResponse>(
				{ success: false, message: `媒体拉取失败（HTTP ${upstream.status}）` },
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}

		const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream'
		const headers: Record<string, string> = {
			'Content-Type': contentType,
			'Cache-Control': 'no-store',
		}
		if (!inline) {
			headers['Content-Disposition'] = disposition('attachment')
		} else if (hasName) {
			// inline 预览但带上建议文件名：播放器原生「下载」菜单取这个名字，否则只能叫 proxy.mp4
			headers['Content-Disposition'] = disposition('inline')
		}
		for (const key of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
			const value = upstream.headers.get(key)
			if (value) headers[key] = value
		}

		// inline + Range（视频分段预览）：纯透传，不缓存（浏览器只读元数据/分段，拉了也传不完）
		if (inline && range) {
			return new Response(upstream.body, { status: upstream.status, headers })
		}

		// 缓存判定：无 Content-Length 不缓存；单条解析记录累计超 50MB 整条不缓存
		const size = Number(upstream.headers.get('Content-Length') || 0)
		let cacheable = size > 0
		if (cacheable) {
			const used = from
				? await mediaCacheService
						.sumRecordMediaSize(person, from)
						.catch(() => MEDIA_CACHE_MAX_RECORD_BYTES)
				: 0
			if (size > MEDIA_CACHE_MAX_RECORD_BYTES || used + size > MEDIA_CACHE_MAX_RECORD_BYTES) {
				cacheable = false
			}
		}

		if (!cacheable) {
			return new Response(upstream.body, { status: 200, headers })
		}

		// tee：一路回客户端，一路传 COS 公有桶；上传完成才落库，失败只记日志不影响下载。
		// key 末段带文件名：302 命中后播放器原生下载/直链保存能拿到正常文件名
		const cosKey = hasName
			? `media-cache/${urlHash}/${rawName}`
			: `media-cache/${urlHash}.${extForCacheKey(url, contentType)}`
		const source = Readable.fromWeb(upstream.body as never)
		const toClient = new PassThrough()
		const toCos = new PassThrough()
		source.on('error', (err) => {
			toClient.destroy(err)
			toCos.destroy(err)
		})
		source.pipe(toClient)
		source.pipe(toCos)
		cosService
			.uploadStream(toCos, cosKey, contentType, size)
			.then(() =>
				mediaCacheService.recordMedia({
					person,
					parseUrl: from,
					urlHash,
					cosKey,
					contentType,
					size,
				}),
			)
			.catch((err) => console.error('[MediaCache] 媒体缓存写入失败:', err))

		return new Response(Readable.toWeb(toClient) as ReadableStream, { status: 200, headers })
	} catch (err) {
		// undici 的真实原因藏在 cause 里（fetch failed 本身没有信息量）
		const cause = err instanceof Error ? err.cause : null
		console.error('Media proxy failed:', err, cause ? { cause } : '')
		return c.json<ApiResponse>(
			{ success: false, message: '媒体拉取失败，请稍后重试' },
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		)
	}
})

export default mediaRoutes
