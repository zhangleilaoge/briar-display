import { type KimiUsageResponse, type KimiUsageSummary, normalizeKimiUsage } from '@briar/shared'
import { KIMI_API_KEY_NAME, siteSecretDal } from '../dal/siteSecretDal'
import { maskSecretHint, openSecret, sealSecret } from '../lib/secretBox'

/** 上游与 KimiCodeBar 一致；Key 可为 sk-kimi- API Key 或 OAuth access token，均以 Bearer 携带 */
export const KIMI_USAGES_URL = 'https://api.kimi.com/coding/v1/usages'
/** 成功缓存 60s，失败 15s 内不重打上游 */
export const KIMI_CACHE_MS = 60_000
export const KIMI_ERROR_CACHE_MS = 15_000

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export type KimiKeyResolver = () => Promise<{ key: string | null; hint: string | null }>

interface CacheState {
	data: KimiUsageSummary | null
	fetchedAt: number
	error?: string
	errorAt?: number
}

let cache: CacheState = { data: null, fetchedAt: 0 }
let inflight: Promise<KimiUsageResponse> | null = null
let keyCache: { key: string | null; hint: string | null; loadedAt: number } | null = null
const KEY_CACHE_MS = 60_000

export function resetKimiUsageCache() {
	cache = { data: null, fetchedAt: 0 }
	inflight = null
	keyCache = null
}

async function resolveKeyFromDb(): Promise<{ key: string | null; hint: string | null }> {
	const now = Date.now()
	if (keyCache && now - keyCache.loadedAt < KEY_CACHE_MS) {
		return { key: keyCache.key, hint: keyCache.hint }
	}
	const row = await siteSecretDal.findActive(KIMI_API_KEY_NAME)
	if (!row) {
		keyCache = { key: null, hint: null, loadedAt: now }
		return keyCache
	}
	try {
		const key = openSecret(row.ciphertext)
		keyCache = { key, hint: row.hint || maskSecretHint(key), loadedAt: now }
		return keyCache
	} catch (err) {
		console.warn('[kimi] failed to open stored api key:', err instanceof Error ? err.message : err)
		keyCache = { key: null, hint: row.hint || null, loadedAt: now }
		return keyCache
	}
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
	opts: {
		fetchFn?: FetchFn
		now?: () => number
		force?: boolean
		resolveKey?: KimiKeyResolver
	} = {},
): Promise<KimiUsageResponse> {
	const now = opts.now ?? Date.now
	const { key, hint } = await (opts.resolveKey ?? resolveKeyFromDb)()
	if (!key) return { configured: false, keyHint: null, data: null, fetchedAt: now() }

	const t = now()
	if (!opts.force) {
		if (cache.data && t - cache.fetchedAt < KIMI_CACHE_MS) {
			return {
				configured: true,
				keyHint: hint,
				data: cache.data,
				fetchedAt: cache.fetchedAt,
			}
		}
		if (cache.error && cache.errorAt && t - cache.errorAt < KIMI_ERROR_CACHE_MS) {
			return staleOrError(cache.error, hint)
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
			return { configured: true, keyHint: hint, data, fetchedAt: cache.fetchedAt }
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			cache = { ...cache, error: msg, errorAt: now() }
			return staleOrError(msg, hint)
		} finally {
			inflight = null
		}
	})()
	return inflight
}

function staleOrError(error: string, hint: string | null): KimiUsageResponse {
	if (cache.data) {
		return {
			configured: true,
			keyHint: hint,
			data: cache.data,
			fetchedAt: cache.fetchedAt,
			stale: true,
			error,
		}
	}
	return {
		configured: true,
		keyHint: hint,
		data: null,
		fetchedAt: cache.errorAt ?? 0,
		error,
	}
}

/** 管理员保存 / 覆盖 Key；全文只进密文列，返回脱敏 hint */
export async function saveKimiApiKey(
	apiKey: string,
	updatedBy: string | null,
): Promise<{ hint: string }> {
	const trimmed = apiKey.trim()
	if (!trimmed) throw new Error('API Key 不能为空')
	if (trimmed.length < 8) throw new Error('API Key 太短')
	const hint = maskSecretHint(trimmed)
	await siteSecretDal.upsert({
		name: KIMI_API_KEY_NAME,
		ciphertext: sealSecret(trimmed),
		hint,
		updatedBy,
	})
	resetKimiUsageCache()
	return { hint }
}

/** 软删除已存 Key */
export async function clearKimiApiKey(): Promise<boolean> {
	const ok = await siteSecretDal.softDelete(KIMI_API_KEY_NAME)
	resetKimiUsageCache()
	return ok
}
