import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { __resetMarketCache } from './cache'
import { fetchHkStockQuotes, mergeHkStockQuotes, parseSinaHkStockQuotes } from './hkStockSources'
import { zonedTimeToTs } from './session'
import { getStockQuotes } from './stockService'
import { parseTencentStockQt } from './stockSources'

const sinaLine = (code: string, name = 'XIAOMI-W') => {
	const fields = [
		'XIAOMI-W',
		name,
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
	return `var hq_str_rt_hk${code}="${fields.join(',')}";`
}

const qtLine = (key: string, fields: Record<number, string>) => {
	const f = Array.from({ length: 80 }, (_, i) => fields[i] ?? '')
	return `v_${key}="${f.join('~')}";`
}

const tencentLine = (code: string) =>
	qtLine(`hk${code}`, {
		1: '小米集团-W',
		3: '26.700',
		4: '25.800',
		6: '999',
		30: '2026/10/23 15:53:10',
		31: '0.900',
		32: '3.488',
		33: '27.300',
		34: '25.900',
		37: '123',
		39: '15.64',
		45: '6963.65',
		59: '0.21',
	})

describe('港股个股行情', () => {
	test('新浪 rt_hk 批量解析：价格、成交量、港元及行情时间', () => {
		const rows = parseSinaHkStockQuotes(
			`${sinaLine('01810', '小米集团－Ｗ')}\nvar hq_str_rt_hk00700="bad";\nvar hq_str_rt_hk99999="empty"`,
		)
		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({
			market: 'hk',
			code: '01810',
			name: '小米集团－Ｗ',
			price: 26.8,
			change: 1,
			changePct: 3.876,
			prevClose: 25.8,
			open: 26,
			high: 27.4,
			low: 25.88,
			amount: 5820825617.8,
			volume: 216285102,
			pe: 14.875,
			currency: 'HKD',
			source: '新浪行情 rt_hk',
			delayMinutes: 0,
		})
		expect(rows[0].quoteTime).toBe(zonedTimeToTs('Asia/Hong_Kong', 2026, 10, 23, 16, 8, 10))
	})

	test('腾讯只补名称和估值，不覆盖新浪价格或时间；缺代码保留延迟标识', () => {
		const primary = parseSinaHkStockQuotes(sinaLine('01810'))
		const fallback = parseTencentStockQt(`${tencentLine('01810')}\n${tencentLine('00700')}`)
		const rows = mergeHkStockQuotes(['01810', '00700', '99999'], primary, fallback)
		expect(rows).toHaveLength(2)
		expect(rows[0]).toMatchObject({
			code: '01810',
			name: '小米集团-W',
			price: 26.8,
			changePct: 3.876,
			volume: 216285102,
			amount: 5820825617.8,
			turnoverRate: 0.21,
			marketCap: 696365000000,
			pe: 14.875,
			source: '新浪行情 rt_hk',
			delayMinutes: 0,
		})
		expect(rows[0].quoteTime).toBe(zonedTimeToTs('Asia/Hong_Kong', 2026, 10, 23, 16, 8, 10))
		expect(rows[1]).toMatchObject({ code: '00700', price: 26.7, delayMinutes: 15 })
		expect(mergeHkStockQuotes(['01810'], [], [])).toEqual([])
	})

	describe('自选批量报价接入', () => {
		const realFetch = globalThis.fetch
		let calls: string[] = []
		let sinaDown = false

		beforeEach(() => {
			__resetMarketCache()
			calls = []
			sinaDown = false
			globalThis.fetch = mock(async (input: string | URL | Request) => {
				const url = String(input)
				calls.push(url)
				if (url.includes('hq.sinajs.cn')) {
					return sinaDown
						? new Response('unavailable', { status: 503 })
						: new Response(sinaLine('01810'), { status: 200 })
				}
				if (url.includes('qt.gtimg.cn')) {
					const body = url.includes('usAAPL')
						? qtLine('usAAPL', { 1: 'Apple', 3: '260' })
						: tencentLine('01810')
					return new Response(body, { status: 200 })
				}
				throw new Error(`unexpected request: ${url}`)
			}) as unknown as typeof fetch
		})

		afterEach(() => {
			globalThis.fetch = realFetch
			__resetMarketCache()
		})

		test('港股从腾讯批量组拆出，正常返回新浪报价', async () => {
			const result = await getStockQuotes([
				{ market: 'hk', code: '01810' },
				{ market: 'us', code: 'AAPL' },
			])
			expect(result.items).toHaveLength(2)
			expect(result.items[0]).toMatchObject({
				code: '01810',
				price: 26.8,
				source: '新浪行情 rt_hk',
				delayMinutes: 0,
			})
			expect(calls.some((url) => url.includes('list=rt_hk01810'))).toBe(true)
			const tencent = calls.find((url) => url.includes('qt.gtimg.cn') && url.includes('usAAPL'))
			expect(tencent).toContain('q=usAAPL')
			expect(tencent).not.toContain('hk01810')
		})

		test('新浪整体失败时才保留腾讯 15 分钟延迟', async () => {
			sinaDown = true
			const result = await getStockQuotes([{ market: 'hk', code: '01810' }])
			expect(result.items[0]).toMatchObject({ price: 26.7, delayMinutes: 15 })
		})

		test('两源同时失败直接报错，不生成空行情', async () => {
			globalThis.fetch = mock(async () => {
				throw new Error('offline')
			}) as unknown as typeof fetch
			await expect(fetchHkStockQuotes(['01810'])).rejects.toThrow(
				'新浪港股行情: hq.sinajs.cn: offline; 腾讯港股行情: qt.gtimg.cn: offline',
			)
		})
	})
})
