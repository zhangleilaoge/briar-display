import type { ApiResponse, MediaParseResult } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { authService } from '../services/authService'
import { permissionService } from '../services/permissionService'
import { getWechatCookieHeader, parseWechatArticle } from '../services/wechatMediaService'

const mediaRoutes = new Hono()

/** 解析上游（逆向自 catsapi.com/labs/media-parser） */
const PARSE_API_URL = 'https://catsapi.com/api/labs/media-parser/parse'
const PARSE_TIMEOUT_MS = 60_000
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

/**
 * 解析结果缓存（进程内）：按「人」隔离——登录用户按 userId，未登录按 IP。
 * 每人 LRU 保留最近 10 条，与前端历史记录条数一致（历史记录里重新解析 = 直接命中）。
 * 上游返回的 CDN 签名 URL 有时效，条目 1 小时过期，惰性清理。
 */
const PARSE_CACHE_TTL_MS = 60 * 60 * 1000
const PARSE_CACHE_PER_PERSON = 10
const PARSE_CACHE_MAX_PERSONS = 2000
type ParseCacheEntry = { data: MediaParseResult; expireAt: number }
const parseCache = new Map<string, Map<string, ParseCacheEntry>>()

function getCachedParse(person: string, url: string): MediaParseResult | null {
	const bucket = parseCache.get(person)
	const entry = bucket?.get(url)
	if (!entry) return null
	if (entry.expireAt <= Date.now()) {
		bucket?.delete(url)
		return null
	}
	return entry.data
}

function setCachedParse(person: string, url: string, data: MediaParseResult) {
	let bucket = parseCache.get(person)
	if (!bucket) {
		// 兜底：人数过多时整表清空（缓存而已，代价是一次 miss）
		if (parseCache.size >= PARSE_CACHE_MAX_PERSONS) parseCache.clear()
		bucket = new Map()
		parseCache.set(person, bucket)
	}
	bucket.delete(url) // 重插到最新位置
	bucket.set(url, { data, expireAt: Date.now() + PARSE_CACHE_TTL_MS })
	// LRU：每人最多 10 条，Map 迭代序即插入序，删最旧
	while (bucket.size > PARSE_CACHE_PER_PERSON) {
		const oldest = bucket.keys().next().value
		if (oldest === undefined) break
		bucket.delete(oldest)
	}
}

function getHostname(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase()
	} catch {
		return null
	}
}

/** 识别支持的平台：小红书/抖音（含短链）走 catsapi，公众号文章走自研解析 */
function detectPlatform(url: string): 'xhs' | 'wechat' | 'douyin' | null {
	const host = getHostname(url)
	if (!host) return null
	if (
		host === 'xiaohongshu.com' ||
		host.endsWith('.xiaohongshu.com') ||
		host === 'xhslink.com' ||
		host.endsWith('.xhslink.com')
	) {
		return 'xhs'
	}
	if (host === 'douyin.com' || host.endsWith('.douyin.com') || host.endsWith('.iesdouyin.com')) {
		return 'douyin'
	}
	if (host === 'mp.weixin.qq.com') return 'wechat'
	return null
}

function isAllowedProxyUrl(url: string): boolean {
	const host = getHostname(url)
	if (!host) return false
	return ALLOWED_PROXY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** POST /parse — 解析分享链接，返回无水印媒体地址（免登录，IP 限频；命中缓存不占限频） */
mediaRoutes.post('/parse', async (c) => {
	const user = await resolveOptionalUser(c)
	// 缓存按「人」隔离：登录按 userId，未登录按 IP
	const person = user ? `u:${user.id}` : `ip:${clientIp(c)}`

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
			{ success: false, message: '目前支持小红书、抖音、微信公众号文章链接' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	// 命中本人缓存直接返回（X-Cache 便于排查），不消耗限频
	const cached = getCachedParse(person, url)
	if (cached) {
		c.header('X-Cache', 'hit')
		return c.json<ApiResponse<MediaParseResult>>({ success: true, data: cached })
	}

	if (await isRateLimited(c, user, 'parse', PARSE_RATE_LIMIT)) return tooManyRequests(c)

	// 公众号文章走自研解析（wechatMediaService），其余转发 catsapi
	if (platform === 'wechat') {
		try {
			const data = await parseWechatArticle(url)
			if (data.images.length === 0 && data.videos.length === 0 && data.live_photos.length === 0) {
				return c.json<ApiResponse>(
					{ success: false, message: '未解析到可下载的媒体' },
					HTTP_STATUS.INTERNAL_SERVER_ERROR,
				)
			}
			setCachedParse(person, url, data)
			c.header('X-Cache', 'miss')
			return c.json<ApiResponse<MediaParseResult>>({ success: true, data })
		} catch (err) {
			console.error('Wechat article parse failed:', err)
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
		setCachedParse(person, url, data)
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

/**
 * GET /proxy?url=...&name=...&inline=1 — 媒体代理（解决 CDN 防盗链/跨域，免登录，IP 限频）
 * 默认附件形式返回（下载）；inline=1 时不带 Content-Disposition（<video>/<img> 预览用）
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
		// 透传 Range（<video> 流式播放依赖 206 分段）
		const range = c.req.header('range')
		if (range) reqHeaders.Range = range
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

		const inline = c.req.query('inline') === '1'
		const rawName = (c.req.query('name') || 'media').replace(/[^\w.一-龥-]+/g, '_').slice(-120)
		const headers: Record<string, string> = {
			'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
			'Cache-Control': 'no-store',
		}
		if (!inline) {
			headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(rawName)}`
		} else if (c.req.query('name')) {
			// inline 预览但带上建议文件名：播放器原生「下载」菜单取这个名字，否则只能叫 proxy.mp4
			headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(rawName)}`
		}
		for (const key of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
			const value = upstream.headers.get(key)
			if (value) headers[key] = value
		}

		return new Response(upstream.body, { status: upstream.status, headers })
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
