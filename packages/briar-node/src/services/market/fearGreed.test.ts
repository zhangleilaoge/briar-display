import { describe, expect, test } from 'bun:test'
import { type Candle, fearGreedBand, fearGreedLabel } from '@briar/shared'
import { FG_MIN_COMPONENTS, computeFearGreed, linearScore, percentileRank, rsi } from './fearGreed'
import { mapLimit } from './fearGreedService'

/** 由收盘序列造日 K：高低 = 收盘 ±0.5%，成交量可指定 */
function makeCandles(closes: number[], vol: (i: number) => number | null = () => 1000): Candle[] {
	return closes.map((c, i) => {
		const d = new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
		return [d, c, c * 1.005, c * 0.995, c, vol(i)]
	})
}
const series = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i))
const comp = (r: ReturnType<typeof computeFearGreed>, key: string) =>
	r.components.find((c) => c.key === key)

describe('恐贪：基础函数', () => {
	test('线性映射截断到 0–100', () => {
		expect(linearScore(0, -0.2, 0.2)).toBe(50)
		expect(linearScore(0.2, -0.2, 0.2)).toBe(100)
		expect(linearScore(-0.5, -0.2, 0.2)).toBe(0)
		expect(linearScore(0.1, -0.2, 0.2)).toBeCloseTo(75, 6)
	})

	test('RSI：一路涨 100、一路跌 0、走平 50、数据不足 null', () => {
		expect(rsi(series(30, (i) => 10 + i))).toBe(100)
		expect(rsi(series(30, (i) => 100 - i))).toBe(0)
		expect(rsi(series(30, () => 10))).toBe(50)
		expect(rsi(series(10, (i) => i + 1))).toBeNull()
		// 涨跌交替、幅度相同 → 接近 50
		const zig = rsi(series(200, (i) => (i % 2 ? 11 : 10)))
		expect(zig).toBeGreaterThan(45)
		expect(zig).toBeLessThan(55)
	})

	test('百分位：严格小于 + 一半相等', () => {
		expect(percentileRank([1, 2, 3, 4], 5)).toBe(1)
		expect(percentileRank([1, 2, 3, 4], 0)).toBe(0)
		expect(percentileRank([1, 2, 3, 4], 2)).toBe(0.375)
	})

	test('分档边界', () => {
		expect([0, 24, 24.4, 24.5, 25, 44, 45, 55, 55.4, 56, 75, 76, 100].map(fearGreedBand)).toEqual([
			'extreme-fear',
			'extreme-fear',
			'extreme-fear',
			'fear', // 四舍五入 25
			'fear',
			'fear',
			'neutral',
			'neutral',
			'neutral',
			'greed',
			'greed',
			'extreme-greed',
			'extreme-greed',
		])
		expect(fearGreedBand(null)).toBeNull()
		expect(fearGreedBand(Number.NaN)).toBeNull()
		expect(fearGreedLabel('greed')).toBe('贪婪')
		expect(fearGreedLabel(null)).toBe('—')
	})
})

describe('恐贪：综合分', () => {
	test('稳步上涨 → 贪婪；稳步下跌 → 恐惧', () => {
		const up = computeFearGreed({ candles: makeCandles(series(300, (i) => 100 * 1.003 ** i)) })
		const down = computeFearGreed({ candles: makeCandles(series(300, (i) => 100 * 0.997 ** i)) })
		expect(up.score).toBeGreaterThan(60)
		expect(down.score).toBeLessThan(40)
		expect(comp(up, 'range52w')?.score).toBeGreaterThan(95)
		expect(comp(down, 'range52w')?.score).toBeLessThan(5)
		expect(comp(up, 'rsi14')?.score).toBe(100)
		expect(up.components).toHaveLength(7) // 没给资金流就没有 netInflow 项
		expect(up.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
	})

	test('均线偏离：高于 125 日均线 10% → 75 分', () => {
		const closes = [...series(299, () => 100), 110]
		const r = computeFearGreed({ candles: makeCandles(closes) })
		const ma125 = (100 * 124 + 110) / 125
		expect(comp(r, 'ma125')?.value).toBeCloseTo(110 / ma125 - 1, 4)
		expect(comp(r, 'ma125')?.score).toBeCloseTo(linearScore(110 / ma125 - 1, -0.2, 0.2), 1)
		expect(comp(r, 'momentum20')?.score).toBeCloseTo(linearScore(0.1, -0.15, 0.15), 1)
	})

	test('波动率越高越恐惧：最近 20 天剧烈震荡 → 波动分接近 0', () => {
		const closes = series(300, (i) => (i < 280 ? 100 + (i % 2) * 0.1 : i % 2 ? 110 : 90))
		const r = computeFearGreed({ candles: makeCandles(closes) })
		expect(comp(r, 'volatility')?.score).toBeLessThan(5)
		const calm = computeFearGreed({
			candles: makeCandles(
				series(300, (i) => (i < 280 ? (i % 2 ? 110 : 90) : 100 + (i % 2) * 0.1)),
			),
		})
		expect(comp(calm, 'volatility')?.score).toBeGreaterThan(95)
	})

	test('量能：放量上涨贪婪、放量下跌恐惧、2 倍量封顶；盘中最后一根不计量', () => {
		const n = 200
		const bigVol = (i: number) => (i >= n - 5 ? 4000 : 1000)
		const up = computeFearGreed({
			candles: makeCandles(
				series(n, (i) => 100 + i * 0.1),
				bigVol,
			),
		})
		const down = computeFearGreed({
			candles: makeCandles(
				series(n, (i) => 200 - i * 0.1),
				bigVol,
			),
		})
		expect(comp(up, 'volume')?.score).toBe(100)
		expect(comp(down, 'volume')?.score).toBe(0)
		// 最后一根盘中量很小：partialLast 时被剔除，不会被当成缩量
		const partial = makeCandles(series(n, (i) => 100 + i * 0.1))
		partial[n - 1][5] = 1
		expect(comp(computeFearGreed({ candles: partial, partialLast: true }), 'volume')?.score).toBe(
			50,
		)
		expect(comp(computeFearGreed({ candles: partial }), 'volume')?.score).toBeLessThan(50)
	})

	test('无成交量 / 数据不足：分项为 null 且不计入均值；少于 4 项 → 综合分 null', () => {
		const noVol = computeFearGreed({
			candles: makeCandles(
				series(300, (i) => 100 + i),
				() => null,
			),
		})
		expect(comp(noVol, 'volume')?.score).toBeNull()
		const valid = noVol.components.filter((c) => c.score != null).map((c) => c.score as number)
		expect(noVol.score).toBeCloseTo(valid.reduce((a, b) => a + b, 0) / valid.length, 1)

		const short = computeFearGreed({ candles: makeCandles(series(30, (i) => 100 + i)) })
		const shortValid = short.components.filter((c) => c.score != null).length
		expect(shortValid).toBeLessThan(FG_MIN_COMPONENTS)
		expect(short.score).toBeNull()
		expect(computeFearGreed({ candles: [] }).score).toBeNull()
	})

	test('A股板块资金流：净流入占成交额 ±10% 映射；缺数据显示为 null 项', () => {
		const candles = makeCandles(series(300, () => 100))
		const inflow = computeFearGreed({ candles, flow: { netInflow: 5e8, amount: 1e10 } })
		expect(comp(inflow, 'netInflow')?.score).toBe(75)
		const missing = computeFearGreed({ candles, flow: { netInflow: null, amount: 1e10 } })
		expect(comp(missing, 'netInflow')?.score).toBeNull()
		expect(missing.components).toHaveLength(8)
	})

	test('非法收盘价被过滤', () => {
		const c = makeCandles(series(100, () => 10))
		c[50][4] = 0
		expect(computeFearGreed({ candles: c }).candles).toBe(99)
	})
})

describe('批量并发', () => {
	test('mapLimit 保序且并发不超过上限', async () => {
		let active = 0
		let peak = 0
		const out = await mapLimit(
			series(20, (i) => i),
			6,
			async (i) => {
				active++
				peak = Math.max(peak, active)
				await new Promise((r) => setTimeout(r, 2))
				active--
				return i * 2
			},
		)
		expect(out).toEqual(series(20, (i) => i * 2))
		expect(peak).toBeLessThanOrEqual(6)
	})
})
