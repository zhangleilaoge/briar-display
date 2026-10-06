/**
 * 行情内存缓存（进程内全局共享，所有用户 / 会话共用一份）：
 * - TTL：过期后才重新请求上游
 * - 单飞（single-flight）：同一 key 过期时只有一个请求打上游，其余并发请求 await 同一个 in-flight Promise；
 *   无论成功失败都在 finally 里清掉 pending，失败不会一直锁住
 * - 上游失败：有旧值返回旧值 + stale 标记，失败后 10s 冷却期内直接回旧值不再撞上游；从未成功过才抛错
 * - 上限：LRU，最多 BRIAR_MARKET_CACHE_MAX 条（默认 500，chart 的 code × period 组合较多），
 *   每分钟清理一次「过期且超过保留期」的条目；定时器 unref()，不拖住进程退出和测试
 */
interface Entry<T> {
	value: T
	fetchedAt: number
	ttlMs: number
}

export interface CachedResult<T> {
	value: T
	fetchedAt: number
	stale: boolean
	error?: string
}

/** 上游失败后的冷却期：期间有旧值就直接返回 stale，避免每个请求都去撞失败/限频的上游 */
export const ERROR_COOLDOWN_MS = 10_000
/** 过期条目再保留多久（供上游失败时兜底回旧值），超过就被定时清理 */
export const STALE_RETAIN_MS = 60 * 60_000
const SWEEP_INTERVAL_MS = 60_000

const DEFAULT_MAX_ENTRIES = 500

/** 缓存条目上限：BRIAR_MARKET_CACHE_MAX，限定 50–5000，默认 500 */
export function resolveMaxEntries(raw = process.env.BRIAR_MARKET_CACHE_MAX): number {
	const n = Number(raw)
	if (!raw || !Number.isFinite(n)) return DEFAULT_MAX_ENTRIES
	return Math.min(5000, Math.max(50, Math.floor(n)))
}

let maxEntries = resolveMaxEntries()

// Map 保持插入顺序：命中时删了重插 = 移到最新，淘汰时从头部删最久未用的
const store = new Map<string, Entry<unknown>>()
const pending = new Map<string, Promise<void>>()
const lastError = new Map<string, { at: number; message: string }>()

function touch(key: string, entry: Entry<unknown>) {
	store.delete(key)
	store.set(key, entry)
}

function evictOverflow() {
	while (store.size > maxEntries) {
		const oldest = store.keys().next().value as string
		store.delete(oldest)
		lastError.delete(oldest)
	}
}

/** 清理过期超过保留期的条目和过时的错误记录（定时调用，也可手动调） */
export function sweepMarketCache(now = Date.now()) {
	for (const [key, entry] of store) {
		if (now - entry.fetchedAt > entry.ttlMs + STALE_RETAIN_MS) {
			store.delete(key)
			lastError.delete(key)
		}
	}
	for (const [key, err] of lastError) {
		if (!store.has(key) && now - err.at > ERROR_COOLDOWN_MS) lastError.delete(key)
	}
}

const sweepTimer = setInterval(() => sweepMarketCache(), SWEEP_INTERVAL_MS)
sweepTimer.unref?.()

export async function cachedLoad<T>(
	key: string,
	ttlMs: number,
	loader: () => Promise<T>,
): Promise<CachedResult<T>> {
	const now = Date.now()
	const hit = store.get(key) as Entry<T> | undefined
	if (hit && now - hit.fetchedAt < ttlMs) {
		touch(key, hit)
		return { value: hit.value, fetchedAt: hit.fetchedAt, stale: false }
	}
	const recentError = lastError.get(key)
	if (hit && recentError && now - recentError.at < ERROR_COOLDOWN_MS) {
		return { value: hit.value, fetchedAt: hit.fetchedAt, stale: true, error: recentError.message }
	}

	let task = pending.get(key)
	if (!task) {
		task = (async () => {
			const value = await loader()
			store.delete(key)
			store.set(key, { value, fetchedAt: Date.now(), ttlMs })
			lastError.delete(key)
			evictOverflow()
		})().finally(() => pending.delete(key))
		pending.set(key, task)
	}

	try {
		await task
		const entry = store.get(key) as Entry<T> | undefined
		// 极端情况下刚写入就被 LRU 挤掉：重新走一遍（不会再撞上游以外的状态）
		if (!entry) return cachedLoad(key, ttlMs, loader)
		return { value: entry.value, fetchedAt: entry.fetchedAt, stale: false }
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		lastError.set(key, { at: Date.now(), message })
		const fallback = store.get(key) as Entry<T> | undefined
		if (fallback) {
			console.warn(`[markets] ${key} 上游失败，返回缓存: ${message}`)
			return { value: fallback.value, fetchedAt: fallback.fetchedAt, stale: true, error: message }
		}
		throw err
	}
}

/** 监控 / 测试用：当前条目数与在途请求数 */
export function marketCacheStats() {
	return { size: store.size, pending: pending.size, maxEntries }
}

/** 仅测试用：清空缓存，可临时改上限 */
export function __resetMarketCache(options: { maxEntries?: number } = {}) {
	store.clear()
	pending.clear()
	lastError.clear()
	maxEntries = options.maxEntries ?? resolveMaxEntries()
}
