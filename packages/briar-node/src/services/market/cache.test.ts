import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import {
	ERROR_COOLDOWN_MS,
	STALE_RETAIN_MS,
	__resetMarketCache,
	cachedLoad,
	marketCacheStats,
	resolveMaxEntries,
	sweepMarketCache,
} from './cache'
import { resolveOpenTtlMs } from './session'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('行情缓存', () => {
	let now = 1_000_000
	let clock: ReturnType<typeof spyOn>
	let warn: ReturnType<typeof spyOn>
	beforeEach(() => {
		__resetMarketCache()
		now = 1_000_000
		clock = spyOn(Date, 'now').mockImplementation(() => now)
		warn = spyOn(console, 'warn').mockImplementation(() => {})
	})
	afterEach(() => {
		clock.mockRestore()
		warn.mockRestore()
	})

	test('并发 N 个请求只打一次上游，TTL 内命中缓存', async () => {
		let calls = 0
		const loader = async () => {
			calls++
			await sleep(5)
			return calls
		}
		const results = await Promise.all(
			Array.from({ length: 20 }, () => cachedLoad('k', 20_000, loader)),
		)
		expect(calls).toBe(1)
		expect(results.every((r) => r.value === 1 && !r.stale)).toBe(true)
		expect(marketCacheStats().pending).toBe(0)
		now += 19_999
		expect((await cachedLoad('k', 20_000, loader)).value).toBe(1)
		expect(calls).toBe(1)
	})

	test('TTL 过期后重新请求上游（过期时的并发同样单飞）', async () => {
		let calls = 0
		const loader = async () => {
			calls++
			await sleep(5)
			return calls
		}
		await cachedLoad('k', 20_000, loader)
		now += 20_000
		const again = await Promise.all([1, 2, 3].map(() => cachedLoad('k', 20_000, loader)))
		expect(calls).toBe(2)
		expect(again.map((r) => r.value)).toEqual([2, 2, 2])
	})

	test('上游失败：有旧值返回 stale + error，冷却期内不再打上游，冷却期过后重新打上游', async () => {
		await cachedLoad('k', 0, async () => 'old')
		let calls = 0
		const failing = async () => {
			calls++
			throw new Error('upstream down')
		}
		const [a, b] = await Promise.all([cachedLoad('k', 0, failing), cachedLoad('k', 0, failing)])
		expect(a).toMatchObject({ value: 'old', stale: true, error: 'upstream down' })
		expect(b.stale).toBe(true)
		expect(calls).toBe(1)
		now += ERROR_COOLDOWN_MS - 1
		expect((await cachedLoad('k', 0, failing)).stale).toBe(true)
		expect(calls).toBe(1)
		now += 1
		const recovered = await cachedLoad('k', 0, async () => 'new')
		expect(recovered).toMatchObject({ value: 'new', stale: false })
	})

	test('无旧值时失败直接抛错，锁在 finally 释放，下一次立刻重新打上游', async () => {
		let calls = 0
		const results = await Promise.allSettled(
			[1, 2, 3].map(() =>
				cachedLoad('cold', 20_000, async () => {
					calls++
					await sleep(5)
					throw new Error('boom')
				}),
			),
		)
		expect(calls).toBe(1)
		expect(results.every((r) => r.status === 'rejected')).toBe(true)
		expect(marketCacheStats().pending).toBe(0)
		const ok = await cachedLoad('cold', 20_000, async () => {
			calls++
			return 'ok'
		})
		expect(calls).toBe(2)
		expect(ok.value).toBe('ok')
	})

	test('超过上限按 LRU 淘汰最久未用的条目', async () => {
		__resetMarketCache({ maxEntries: 3 })
		let calls = 0
		const load = (v: string) => async () => {
			calls++
			return v
		}
		await cachedLoad('a', 60_000, load('a'))
		await cachedLoad('b', 60_000, load('b'))
		await cachedLoad('c', 60_000, load('c'))
		await cachedLoad('a', 60_000, load('a')) // 命中，a 变成最近使用
		await cachedLoad('d', 60_000, load('d')) // 挤掉最久未用的 b
		expect(marketCacheStats().size).toBe(3)
		expect(calls).toBe(4)
		await cachedLoad('a', 60_000, load('a'))
		expect(calls).toBe(4)
		await cachedLoad('b', 60_000, load('b'))
		expect(calls).toBe(5)
	})

	test('定期清理：过期超过保留期的条目被删掉，其余保留（供上游失败时回旧值）', async () => {
		const t0 = now
		await cachedLoad('old', 20_000, async () => 1)
		now += 30 * 60_000
		await cachedLoad('later', 20_000, async () => 2)
		sweepMarketCache(t0 + 20_000 + STALE_RETAIN_MS)
		expect(marketCacheStats().size).toBe(2)
		sweepMarketCache(t0 + 20_000 + STALE_RETAIN_MS + 1)
		expect(marketCacheStats().size).toBe(1)
		now = t0 + 20_000 + STALE_RETAIN_MS + 1
		expect((await cachedLoad('later', 20_000, async () => 3)).value).toBe(3)
	})

	test('配置：交易中 TTL 限定 15–30 秒默认 20 秒；条目上限 50–5000 默认 500', () => {
		expect(resolveOpenTtlMs(undefined)).toBe(20_000)
		expect(resolveOpenTtlMs('25')).toBe(25_000)
		expect(resolveOpenTtlMs('5')).toBe(15_000)
		expect(resolveOpenTtlMs('120')).toBe(30_000)
		expect(resolveOpenTtlMs('abc')).toBe(20_000)
		expect(resolveMaxEntries(undefined)).toBe(500)
		expect(resolveMaxEntries('10')).toBe(50)
		expect(resolveMaxEntries('99999')).toBe(5000)
	})
})
