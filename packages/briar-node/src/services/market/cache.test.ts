import { beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { __resetMarketCache, cachedLoad } from './cache'

describe('行情缓存', () => {
	beforeEach(() => __resetMarketCache())

	test('TTL 内命中缓存，并发请求单飞只打一次上游', async () => {
		let calls = 0
		const loader = async () => {
			calls++
			await new Promise((r) => setTimeout(r, 5))
			return calls
		}
		const [a, b] = await Promise.all([
			cachedLoad('k', 60_000, loader),
			cachedLoad('k', 60_000, loader),
		])
		expect(calls).toBe(1)
		expect(a.value).toBe(1)
		expect(b.value).toBe(1)
		expect((await cachedLoad('k', 60_000, loader)).stale).toBe(false)
		expect(calls).toBe(1)
	})

	test('上游失败：有旧值返回 stale + error，冷却期内不再打上游；无旧值才抛错', async () => {
		const warn = spyOn(console, 'warn').mockImplementation(() => {})
		await cachedLoad('k', 0, async () => 'old')
		let calls = 0
		const failing = async () => {
			calls++
			throw new Error('upstream down')
		}
		const first = await cachedLoad('k', 0, failing)
		expect(first).toMatchObject({ value: 'old', stale: true, error: 'upstream down' })
		const second = await cachedLoad('k', 0, failing)
		expect(second.stale).toBe(true)
		expect(calls).toBe(1)
		await expect(cachedLoad('other', 0, failing)).rejects.toThrow('upstream down')
		warn.mockRestore()
	})
})
