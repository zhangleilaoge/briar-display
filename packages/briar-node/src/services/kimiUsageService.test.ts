import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { formatKimiResetIn, normalizeKimiUsage } from '@briar/shared'
import { KIMI_CACHE_MS, getKimiUsage, resetKimiUsageCache } from './kimiUsageService'

const OLD_PLAN = {
	usage: { limit: '1000', used: '250', remaining: '750', resetTime: '2026-11-10T00:00:00Z' },
	limits: [
		{
			window: { duration: 300 },
			detail: { limit: '200', remaining: '50', resetTime: '2026-11-04T12:00:00.000Z' },
		},
	],
	user: { membership: { level: 'LEVEL_INTERMEDIATE' } },
}
const NEW_PLAN = {
	usages: {
		limit_5h: { used_ratio: 0.123, reset_time: '2026-11-04T12:00:00Z' },
		limit_month_total: { used_ratio: 0.42, reset_time: '2026-12-01T00:00:00Z' },
	},
	user: { membership: { level: 'LEVEL_PRO_MAX' } },
	boosterWallet: { status: 'STATUS_ACTIVE', balance: { amountLeft: '315250700' } },
}

describe('normalizeKimiUsage', () => {
	test('老套餐：绝对数值 + 由 remaining 反推 used', () => {
		const s = normalizeKimiUsage(OLD_PLAN)
		expect(s.weekly).toMatchObject({ usedPct: 25, used: 250, limit: 1000, remaining: 750 })
		expect(s.fiveHour).toMatchObject({ usedPct: 75, used: 150, remaining: 50 })
		expect(s.monthly).toBeNull()
		expect(s.membership).toBe('Allegretto')
		expect(s.boosterYuan).toBeNull()
	})
	test('新会员体系：used_ratio 百分比 + 月额度 + 加油包', () => {
		const s = normalizeKimiUsage(NEW_PLAN)
		expect(s.fiveHour?.usedPct).toBe(12)
		expect(s.weekly).toBeNull()
		expect(s.monthly).toMatchObject({ usedPct: 42, resetAt: '2026-12-01T00:00:00Z' })
		expect(s.membership).toBe('Pro Max')
		expect(s.boosterYuan).toBeCloseTo(3.1525)
	})
	test('垃圾输入不抛错', () => {
		expect(normalizeKimiUsage(null)).toMatchObject({ fiveHour: null, weekly: null, monthly: null })
		expect(normalizeKimiUsage({ limits: 'x', usages: 3 }).fiveHour).toBeNull()
	})
})

describe('formatKimiResetIn', () => {
	const now = Date.parse('2026-11-04T08:00:00Z')
	test('各量级', () => {
		expect(formatKimiResetIn('2026-11-04T10:15:00Z', now)).toBe('2时15分')
		expect(formatKimiResetIn('2026-11-07T12:00:00Z', now)).toBe('3天4时')
		expect(formatKimiResetIn('2026-11-04T08:30:00Z', now)).toBe('30分')
		expect(formatKimiResetIn('2026-11-04T07:00:00Z', now)).toBe('即将')
		expect(formatKimiResetIn(null, now)).toBeNull()
		expect(formatKimiResetIn('bad', now)).toBeNull()
	})
})

describe('getKimiUsage', () => {
	const prev = process.env.BRIAR_KIMI_API_KEY
	let calls: { url: string; auth?: string }[] = []
	const ok =
		(body: unknown, status = 200) =>
		async (url: string, init?: RequestInit) => {
			calls.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization })
			return new Response(JSON.stringify(body), { status })
		}
	beforeEach(() => {
		calls = []
		resetKimiUsageCache()
	})
	afterEach(() => {
		if (prev === undefined) process.env.BRIAR_KIMI_API_KEY = ''
		else process.env.BRIAR_KIMI_API_KEY = prev
	})

	test('未配置 Key：不请求上游', async () => {
		process.env.BRIAR_KIMI_API_KEY = ''
		const r = await getKimiUsage({ fetchFn: ok(NEW_PLAN) })
		expect(r.configured).toBe(false)
		expect(calls.length).toBe(0)
	})

	test('Bearer 携带 Key，60s 内命中缓存', async () => {
		process.env.BRIAR_KIMI_API_KEY = 'sk-kimi-test'
		let t = 1_000_000
		const now = () => t
		const r1 = await getKimiUsage({ fetchFn: ok(NEW_PLAN), now })
		expect(r1.data?.monthly?.usedPct).toBe(42)
		expect(calls[0]).toEqual({
			url: 'https://api.kimi.com/coding/v1/usages',
			auth: 'Bearer sk-kimi-test',
		})
		t += KIMI_CACHE_MS - 1
		await getKimiUsage({ fetchFn: ok(NEW_PLAN), now })
		expect(calls.length).toBe(1)
		t += 2
		await getKimiUsage({ fetchFn: ok(NEW_PLAN), now })
		expect(calls.length).toBe(2)
	})

	test('上游 401：返回错误；有旧缓存则 stale 兜底', async () => {
		process.env.BRIAR_KIMI_API_KEY = 'sk-kimi-test'
		let t = 0
		const now = () => t
		const e1 = await getKimiUsage({ fetchFn: ok({ error: { message: 'invalid key' } }, 401), now })
		expect(e1.data).toBeNull()
		expect(e1.error).toContain('401')
		resetKimiUsageCache()
		await getKimiUsage({ fetchFn: ok(NEW_PLAN), now })
		t += KIMI_CACHE_MS + 1
		const e2 = await getKimiUsage({ fetchFn: ok({}, 500), now })
		expect(e2.stale).toBe(true)
		expect(e2.data?.monthly?.usedPct).toBe(42)
	})
})
