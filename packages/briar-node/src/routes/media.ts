import type { ApiResponse, MediaParseResult } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'

const mediaRoutes = new Hono()

/** 解析上游（逆向自 catsapi.com/labs/media-parser） */
const PARSE_API_URL = 'https://catsapi.com/api/labs/media-parser/parse'
const PARSE_TIMEOUT_MS = 60_000
const PROXY_TIMEOUT_MS = 120_000
const MAX_INPUT_LENGTH = 2000

const UPSTREAM_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 下载代理域名白名单（防止被当成开放代理），目前仅放行小红书 CDN */
const ALLOWED_PROXY_HOST_SUFFIXES = ['.xhscdn.com', '.xiaohongshu.com']

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

/** 目前仅支持小红书链接（含 xhslink 短链） */
function isXhsUrl(url: string): boolean {
	const host = getHostname(url)
	if (!host) return false
	return (
		host === 'xiaohongshu.com' ||
		host.endsWith('.xiaohongshu.com') ||
		host === 'xhslink.com' ||
		host.endsWith('.xhslink.com')
	)
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
	if (!url || !isXhsUrl(url)) {
		return c.json<ApiResponse>(
			{ success: false, message: '目前仅支持小红书链接' },
			HTTP_STATUS.BAD_REQUEST,
		)
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
		const upstream = await fetch(url, {
			headers: { 'User-Agent': UPSTREAM_UA, Referer: 'https://www.xiaohongshu.com/' },
			signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
			redirect: 'follow',
		})
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
		console.error('Media proxy failed:', err)
		return c.json<ApiResponse>(
			{ success: false, message: '媒体拉取失败，请稍后重试' },
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		)
	}
})

export default mediaRoutes
