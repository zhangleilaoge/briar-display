/**
 * 行情内存缓存：TTL + 单飞（同 key 并发只打一次上游）+ 失败降级返回旧值（stale）。
 * key 集合是有限的（市场 × 板块类别 × 分级），不需要淘汰；进程重启即清空。
 */
interface Entry<T> {
	value: T
	fetchedAt: number
}

export interface CachedResult<T> {
	value: T
	fetchedAt: number
	stale: boolean
	error?: string
}

/** 上游失败后的冷却期：期间有旧值就直接返回 stale，避免每个请求都去撞失败/限频的上游 */
const ERROR_COOLDOWN_MS = 10_000

const store = new Map<string, Entry<unknown>>()
const pending = new Map<string, Promise<void>>()
const lastError = new Map<string, { at: number; message: string }>()

export async function cachedLoad<T>(
	key: string,
	ttlMs: number,
	loader: () => Promise<T>,
): Promise<CachedResult<T>> {
	const now = Date.now()
	const hit = store.get(key) as Entry<T> | undefined
	if (hit && now - hit.fetchedAt < ttlMs) {
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
			store.set(key, { value, fetchedAt: Date.now() })
			lastError.delete(key)
		})().finally(() => pending.delete(key))
		pending.set(key, task)
	}

	try {
		await task
		const entry = store.get(key) as Entry<T>
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

/** 仅测试用：清空缓存 */
export function __resetMarketCache() {
	store.clear()
	pending.clear()
	lastError.clear()
}
