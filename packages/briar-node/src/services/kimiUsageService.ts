import { type KimiUsageResponse, type KimiUsageSummary, normalizeKimiUsage } from '@briar/shared'

/** 上游与 KimiCodeBar 一致；Key 可为 sk-kimi- API Key 或 OAuth access token，均以 Bearer 携带 */
export const KIMI_USAGES_URL = 'https://api.kimi.com/coding/v1/usages'
/** 成功缓存 60s，失败 15s 内不重打上游 */
export const KIMI_CACHE_MS = 60_000
export const KIMI_ERROR_CACHE_MS = 15_000

const apiKey = () => process.env.BRIAR_KIMI_API_KEY?.trim() || ''

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

interface CacheState {
	data: KimiUsageSummary | null
	fetchedAt: number
	error?: string
	errorAt?: number
}

let cache: CacheState = { data: null, fetchedAt: 0 }
let inflight: Promise<KimiUsageResponse> | null = null

export function resetKimiUsageCache() {
	cache = { data: null, fetchedAt: 0 }
	inflight = null
}

function errorMessage(status: number, body: string): string {
	try {
		const j = JSON.parse(body) as Record<string, unknown>
		const e = j.error
		const msg =
			(typeof e === 'string' && e) ||
			(e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string'
				? (e as { message: string }).message
				: '') ||
			(typeof j.message === 'string' && j.message) ||
			(typeof j.detail === 'string' && j.detail)
		if (msg) return `HTTP ${status}：${msg}`.slice(0, 200)
	} catch {
		/* 非 JSON */
	}
	if (status === 401 || status === 403) return `HTTP ${status}：Key 无效或已过期`
	return `HTTP ${status}`
}

export async function getKimiUsage(
	opts: { fetchFn?: FetchFn; now?: () => number; force?: boolean } = {},
): Promise<KimiUsageResponse> {
	const now = opts.now ?? Date.now
	const key = apiKey()
	if (!key) return { configured: false, data: null, fetchedAt: now() }

	const t = now()
	if (!opts.force) {
		if (cache.data && t - cache.fetchedAt < KIMI_CACHE_MS) {
			return { configured: true, data: cache.data, fetchedAt: cache.fetchedAt }
		}
		if (cache.error && cache.errorAt && t - cache.errorAt < KIMI_ERROR_CACHE_MS) {
			return staleOrError(cache.error)
		}
	}
	if (inflight) return inflight

	const fetchFn = opts.fetchFn ?? ((url, init) => fetch(url, init))
	inflight = (async () => {
		try {
			const res = await fetchFn(KIMI_USAGES_URL, {
				headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
				signal: AbortSignal.timeout(15_000),
			})
			const body = await res.text()
			if (!res.ok) throw new Error(errorMessage(res.status, body))
			const data = normalizeKimiUsage(JSON.parse(body))
			cache = { data, fetchedAt: now() }
			return { configured: true, data, fetchedAt: cache.fetchedAt }
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			cache = { ...cache, error: msg, errorAt: now() }
			return staleOrError(msg)
		} finally {
			inflight = null
		}
	})()
	return inflight
}

function staleOrError(error: string): KimiUsageResponse {
	if (cache.data) {
		return { configured: true, data: cache.data, fetchedAt: cache.fetchedAt, stale: true, error }
	}
	return { configured: true, data: null, fetchedAt: cache.errorAt ?? 0, error }
}
