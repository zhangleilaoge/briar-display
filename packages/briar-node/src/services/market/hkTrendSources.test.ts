import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { ChartPeriod } from '@briar/shared'
import { __resetMarketCache } from './cache'
import { parseSinaHkStockQuotes } from './hkStockSources'
import { parseSinaHkStockMinute } from './hkTrendSources'
import { zonedTimeToTs } from './session'
import { getChart } from './trendService'
import { __resetEastmoneyTrendSlots } from './trendSources'

const sinaLine = () => {
	const fields = [
		'XIAOMI-W',
		'小米集团-W',
		'26.000',
		'25.800',
		'27.400',
		'25.880',
		'26.800',
		'1.000',
		'3.876',
		'26.780',
		'26.810',
		'5820825617.800',
		'216285102',
		'14.875',
		'0.000',
		'47.400',
		'21.300',
		'2026/10/23',
		'16:08:10',
	]
	return `var hq_str_rt_hk01810="${fields.join(',')}";`
}

const minuteResponse = {
	result: {
		status: { code: 0 },
		data: [
			{ m: '09:30:00', v: '100', p: '26.00' },
			{ m: '16:08:00', v: '200', p: '26.80' },
		],
	},
}

const trendsResponse = (ndays: string | null) => ({
	data: {
		name: '小米集团-W',
		preClose: 25.8,
		trends:
			ndays === '1'
				? ['2026-10-23 16:08,26.80,26.80,26.80,26.80,200']
				: [
						'2026-10-22 16:08,27.00,27.00,27.00,27.00,100',
						'2026-10-23 16:08,26.80,26.80,26.80,26.80,200',
					],
	},
})

const klineResponse = {
	data: {
		name: '小米集团-W',
		klines: ['2026-10-22,26.50,27.00,27.20,26.40,1000', '2026-10-23,26.00,26.80,27.40,25.88,2000'],
	},
}

describe('港股个股低延迟走势', () => {
	const realFetch = globalThis.fetch
	let calls: string[]
	let sinaMinuteDown: boolean
	let eastmoneyDown: boolean

	beforeEach(() => {
		__resetMarketCache()
		__resetEastmoneyTrendSlots()
		calls = []
		sinaMinuteDown = false
		eastmoneyDown = false
		globalThis.fetch = mock(async (input: string | URL | Request) => {
			const url = String(input)
			calls.push(url)
			if (url.includes('hq.sinajs.cn')) return new Response(sinaLine())
			if (url.includes('getHKMinline')) {
				return sinaMinuteDown
					? new Response('unavailable', { status: 503 })
					: Response.json(minuteResponse)
			}
			if (url.includes('push2his.eastmoney.com')) {
				if (eastmoneyDown) return new Response('unavailable', { status: 503 })
				if (url.includes('trends2/get')) {
					return Response.json(trendsResponse(new URL(url).searchParams.get('ndays')))
				}
				if (url.includes('kline/get')) return Response.json(klineResponse)
			}
			throw new Error(`unexpected request: ${url}`)
		}) as unknown as typeof fetch
	})

	afterEach(() => {
		globalThis.fetch = realFetch
		__resetMarketCache()
		__resetEastmoneyTrendSlots()
	})

	test('新浪分时按报价交易日补全时间，成交量已是每分钟量', () => {
		const quote = parseSinaHkStockQuotes(sinaLine())[0]
		const trend = parseSinaHkStockMinute(minuteResponse, quote)
		expect(trend).toMatchObject({
			name: '小米集团-W',
			prevClose: 25.8,
			delayMinutes: 0,
			source: '新浪港股分时',
		})
		expect(trend.points).toEqual([
			[zonedTimeToTs('Asia/Hong_Kong', 2026, 10, 23, 9, 30), 26, 100],
			[zonedTimeToTs('Asia/Hong_Kong', 2026, 10, 23, 16, 8), 26.8, 200],
		])
		expect(() =>
			parseSinaHkStockMinute(
				{ result: { status: { code: 11, msg: 'Service not found' }, data: [] } },
				quote,
			),
		).toThrow('Service not found')
	})

	test('个股当日分时使用新浪，不再请求腾讯延迟走势', async () => {
		const chart = await getChart('hk', 'stock', '01810', 'intraday')
		expect(chart).toMatchObject({ available: true, delayMinutes: 0, source: '新浪港股分时' })
		expect(chart.days[0].points.at(-1)?.[1]).toBe(26.8)
		expect(calls.some((url) => url.includes('web.ifzq.gtimg.cn'))).toBe(false)
	})

	test('五日及日周月K全部使用东财，不带15分钟延迟', async () => {
		for (const period of ['5day', 'day', 'week', 'month'] as ChartPeriod[]) {
			const chart = await getChart('hk', 'stock', '01810', period)
			expect(chart).toMatchObject({ available: true, delayMinutes: 0 })
			expect(chart.source).toBe(period === '5day' ? '东方财富五日分时' : '东方财富K线')
			if (period === '5day') expect(chart.days).toHaveLength(2)
			else expect(chart.candles).toHaveLength(2)
		}
		expect(calls.filter((url) => url.includes('push2his.eastmoney.com'))).toHaveLength(4)
		expect(calls.some((url) => url.includes('web.ifzq.gtimg.cn'))).toBe(false)
	})

	test('新浪分时失败可降级东财，两个低延迟源都失败也不回退腾讯', async () => {
		sinaMinuteDown = true
		const fallback = await getChart('hk', 'stock', '01810', 'intraday')
		expect(fallback).toMatchObject({ delayMinutes: 0, source: '东方财富分时' })

		__resetMarketCache()
		__resetEastmoneyTrendSlots()
		calls = []
		eastmoneyDown = true
		await expect(getChart('hk', 'stock', '01810', 'intraday')).rejects.toThrow('HTTP 503')
		expect(calls.some((url) => url.includes('web.ifzq.gtimg.cn'))).toBe(false)
	})
})
