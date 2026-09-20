import type { ApiResponse, MagnetParseResult } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { authService } from '../services/authService'
import { permissionService } from '../services/permissionService'

const magnetRoutes = new Hono()

/** 上游：whatslink.info 公开 API（参考 clyl.246811.xyz 的调用方式） */
const UPSTREAM_API = 'https://whatslink.info/api/v1/link'
/** 单次上游请求超时；首解析上游要去 DHT 抓元数据，偶发慢/500，靠重试兜底 */
const UPSTREAM_TIMEOUT_MS = 25_000
const UPSTREAM_MAX_ATTEMPTS = 3
const MAX_INPUT_LENGTH = 2000
/** 限频：每 IP 每分钟 6 次（与媒体解析一致，超管豁免） */
const PARSE_RATE_LIMIT = 6
const RATE_WINDOW_MS = 60_000

const UPSTREAM_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

type AuthedUser = { id: string }

/** 可选登录态：磁力查询免登录，但登录用户仍需识别（超管豁免限频） */
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

/** 滑动窗口限频（模块级，进程内有效） */
const rateBuckets = new Map<string, number[]>()

function hitRateLimit(key: string, limit: number): boolean {
	const now = Date.now()
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

function clientIp(c: Context): string {
	return (
		(c.req.header('x-forwarded-for') || '').split(',')[0].trim() ||
		c.req.header('x-real-ip') ||
		'unknown'
	)
}

/** 完整 magnet 链接（40 位 hex hash，可带 & 后续参数） */
const MAGNET_RE = /magnet:\?xt=urn:btih:([a-fA-F0-9]{40})(&\S*)?/i
/** 裸 40 位 hex hash */
const BARE_HASH_RE = /(?:^|[^a-fA-F0-9])([a-fA-F0-9]{40})(?:[^a-fA-F0-9]|$)/i
/** ed2k 链接 */
const ED2K_RE = /^ed2k:\/\/\|file\|.+\|\/$/i
/** 其他形态的 magnet（如 32 位 base32 hash），原样交给上游判定 */
const ANY_MAGNET_RE = /^magnet:\?\S*xt=urn:btih:[a-zA-Z2-7=]+/i

/**
 * 归一化输入为可查询链接，归一化不了返回 null。
 * 40 位 hex hash 统一小写（whatslink 按小写 hash 建档）
 */
export function normalizeMagnetInput(raw: string): string | null {
	const input = raw.trim().replace(/\s+/g, '')
	if (!input) return null
	const magnet = input.match(MAGNET_RE)
	if (magnet) return `magnet:?xt=urn:btih:${magnet[1].toLowerCase()}${magnet[2] ?? ''}`
	const bare = input.match(BARE_HASH_RE)
	if (bare) return `magnet:?xt=urn:btih:${bare[1].toLowerCase()}`
	if (ED2K_RE.test(input)) return input
	if (ANY_MAGNET_RE.test(input)) return input
	return null
}

interface WhatslinkResponse {
	error?: string
	message?: string
	type?: string
	file_type?: string
	name?: string
	size?: number
	count?: number
	screenshots?: Array<{ time?: number; screenshot?: string } | string>
}

/** 调 whatslink API；非 200/网络错误重试（首解析 500 常见，上游后台抓完元数据后即命中缓存） */
async function fetchUpstream(link: string): Promise<WhatslinkResponse> {
	let lastErr: unknown = null
	for (let attempt = 0; attempt < UPSTREAM_MAX_ATTEMPTS; attempt++) {
		try {
			const res = await fetch(`${UPSTREAM_API}?url=${encodeURIComponent(link)}`, {
				headers: { 'User-Agent': UPSTREAM_UA, Accept: 'application/json' },
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			})
			if (!res.ok) {
				lastErr = new Error(`whatslink HTTP ${res.status}`)
			} else {
				return (await res.json()) as WhatslinkResponse
			}
		} catch (err) {
			lastErr = err
		}
		if (attempt < UPSTREAM_MAX_ATTEMPTS - 1) {
			await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
		}
	}
	throw lastErr instanceof Error ? lastErr : new Error('查询服务暂时不可用，请稍后重试')
}

/** POST /parse — 查询 magnet/ed2k 链接的名称、大小、文件数与预览截图（免登录，IP 限频） */
magnetRoutes.post('/parse', async (c) => {
	const user = await resolveOptionalUser(c)

	const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string })
	const input = (body.url || '').trim()
	if (!input || input.length > MAX_INPUT_LENGTH) {
		return c.json<ApiResponse>(
			{ success: false, message: '请粘贴 magnet / ed2k 链接或 40 位磁力 hash' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const link = normalizeMagnetInput(input)
	if (!link) {
		return c.json<ApiResponse>(
			{ success: false, message: '无法识别的链接格式，支持 magnet / ed2k / 40 位磁力 hash' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	if (user && (await permissionService.isAdmin(user.id))) {
		// 超管豁免限频
	} else if (hitRateLimit(`magnet-parse:${clientIp(c)}`, PARSE_RATE_LIMIT)) {
		return c.json<ApiResponse>(
			{ success: false, message: '操作太频繁，请稍后再试' },
			HTTP_STATUS.TOO_MANY_REQUESTS,
		)
	}

	try {
		const data = await fetchUpstream(link)
		const upstreamError = (data.error || data.message || '').trim()
		if (upstreamError) {
			return c.json<ApiResponse>(
				{ success: false, message: `查询失败：${upstreamError}` },
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
		if (!data.name) {
			return c.json<ApiResponse>(
				{ success: false, message: '未查询到该链接的信息（资源可能已失效或太过冷门）' },
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
		const screenshots = (Array.isArray(data.screenshots) ? data.screenshots : [])
			.map((item) => (typeof item === 'string' ? item : item?.screenshot))
			.filter((url): url is string => typeof url === 'string' && url.startsWith('http'))
		const result: MagnetParseResult = {
			link,
			name: data.name,
			size: Number(data.size) || 0,
			count: Number(data.count) || 0,
			fileType: data.file_type || data.type || '',
			screenshots,
		}
		return c.json<ApiResponse<MagnetParseResult>>({ success: true, data: result })
	} catch (err) {
		console.error('Magnet parse failed:', err)
		return c.json<ApiResponse>(
			{ success: false, message: '查询服务暂时不可用，请稍后重试' },
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		)
	}
})

export default magnetRoutes
