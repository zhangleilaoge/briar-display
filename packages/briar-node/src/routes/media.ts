import type { ApiResponse, MediaParseResult } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { parseWechatArticle } from '../services/wechatMediaService'

const mediaRoutes = new Hono()

/** 解析上游（逆向自 catsapi.com/labs/media-parser） */
const PARSE_API_URL = 'https://catsapi.com/api/labs/media-parser/parse'
const PARSE_TIMEOUT_MS = 60_000
const PROXY_TIMEOUT_MS = 120_000
const MAX_INPUT_LENGTH = 2000

const UPSTREAM_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 下载代理域名白名单（防止被当成开放代理）：小红书 CDN + 微信图床/视频 CDN */
const ALLOWED_PROXY_HOST_SUFFIXES = ['.xhscdn.com', '.xiaohongshu.com', '.qpic.cn', '.tc.qq.com']

type AuthedUser = { id: string }

function requireUser(c: Context): AuthedUser | null {
	return (c.get('user') as AuthedUser | undefined) ?? null
}

function unauthorized(c: Context) {
	return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
}

/** 从分享文案中提取第一个 URL */
function extractUrl(text: string): string | null {
	const match = text.match(/https?:\/\/[^\s]+/)
	return match ? match[0] : null
}

function getHostname(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase()
	} catch {
		return null
	}
}

/** 识别支持的平台：小红书（含 xhslink 短链）走 catsapi，公众号文章走自研解析 */
function detectPlatform(url: string): 'xhs' | 'wechat' | null {
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
	if (host === 'mp.weixin.qq.com') return 'wechat'
	return null
}

function isAllowedProxyUrl(url: string): boolean {
	const host = getHostname(url)
	if (!host) return false
	return ALLOWED_PROXY_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** POST /parse — 解析小红书分享链接，返回无水印媒体地址 */
mediaRoutes.post('/parse', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string })
	const input = (body.url || '').trim()
	if (!input || input.length > MAX_INPUT_LENGTH) {
		return c.json<ApiResponse>(
			{ success: false, message: '请粘贴小红书链接或分享文案' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const url = extractUrl(input)
	const platform = url ? detectPlatform(url) : null
	if (!url || !platform) {
		return c.json<ApiResponse>(
			{ success: false, message: '目前支持小红书、微信公众号文章链接' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

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

/** GET /proxy?url=...&name=... — 媒体下载代理（解决 CDN 防盗链/跨域，附件形式返回） */
mediaRoutes.get('/proxy', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	// 小红书 CDN 多为 http 链接，服务端统一直连 https
	const url = (c.req.query('url') || '').replace(/^http:\/\//i, 'https://')
	if (!url || !isAllowedProxyUrl(url)) {
		return c.json<ApiResponse>(
			{ success: false, message: '不支持的媒体地址' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	try {
		// 微信图床/CDN 带微信 Referer（实测不带也可），小红书 CDN 带小红书 Referer
		const host = getHostname(url) || ''
		const referer = host.endsWith('.xhscdn.com')
			? 'https://www.xiaohongshu.com/'
			: 'https://mp.weixin.qq.com/'
		// undici 偶发 "fetch failed"（连接池/网络抖动），重试一次
		let upstream: Response | null = null
		let lastErr: unknown = null
		for (let attempt = 0; attempt < 2 && !upstream; attempt++) {
			try {
				upstream = await fetch(url, {
					headers: { 'User-Agent': UPSTREAM_UA, Referer: referer },
					signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
					redirect: 'follow',
				})
			} catch (err) {
				lastErr = err
			}
		}
		if (!upstream) throw lastErr
		if (!upstream.ok || !upstream.body) {
			return c.json<ApiResponse>(
				{ success: false, message: `媒体拉取失败（HTTP ${upstream.status}）` },
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}

		const rawName = (c.req.query('name') || 'media').replace(/[^\w.一-龥-]+/g, '_').slice(-120)
		const headers: Record<string, string> = {
			'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(rawName)}`,
			'Cache-Control': 'no-store',
		}
		const contentLength = upstream.headers.get('Content-Length')
		if (contentLength) headers['Content-Length'] = contentLength

		return new Response(upstream.body, { status: 200, headers })
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
