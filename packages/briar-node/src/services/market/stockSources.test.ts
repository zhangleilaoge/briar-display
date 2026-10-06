import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { __resetMarketCache } from './cache'
import { zonedTimeToTs } from './session'
import {
	CONSTITUENT_CAP,
	constituentSortKeys,
	getConstituents,
	normalizeQuery,
	rankSearchResults,
	searchStocks,
} from './stockService'
import {
	eastmoneyToCnCode,
	looseNum,
	parseEastmoneyBoardStocks,
	parseNaverAc,
	parseNaverGroupStocks,
	parseNaverJpBasic,
	parseNaverStockPolling,
	parseNaverValuation,
	parseTencentBoardStocks,
	parseTencentSmartbox,
	parseTencentStockQt,
	tencentStockCode,
} from './stockSources'
import { clipToSessions } from './trendService'
import { normalizeStockRef, parseStockRefs, sanitizeWatchlistItems } from './watchlist'

/** 腾讯 qt 一行：按下标填字段，其余补空 */
const qtLine = (key: string, fields: Record<number, string>, len = 80) => {
	const f = Array.from({ length: len }, (_, i) => fields[i] ?? '')
	return `v_${key}="${f.join('~')}";`
}

describe('成分股解析', () => {
	test('腾讯板块成分股：成交额万元→元、总市值亿元→元，过滤非 A股代码', () => {
		const { items, total } = parseTencentBoardStocks({
			code: 0,
			data: {
				total: 182,
				rank_list: [
					{
						code: 'sh688498',
						name: '源杰科技',
						zxj: '1613.00',
						zdf: '-1.56',
						turnover: '310837',
						hsl: '1.56',
						pe_ttm: '267.14',
						zsz: '2008.19',
					},
					{ code: 'pt01801081', name: '伪行' },
				],
			},
		})
		expect(total).toBe(182)
		expect(items).toEqual([
			{
				code: 'sh688498',
				name: '源杰科技',
				price: 1613,
				changePct: -1.56,
				amount: 3108370000,
				turnoverRate: 1.56,
				netInflow: null,
				marketCap: 200819000000,
				pe: 267.14,
			},
		])
	})

	test('腾讯板块成分股：接口报错抛异常', () => {
		expect(() => parseTencentBoardStocks({ code: 1, msg: 'sort_type error' })).toThrow(
			'sort_type error',
		)
	})

	test('东财成分股：f13 + f12 → sh/sz/bj 前缀，带主力净流入', () => {
		expect(eastmoneyToCnCode(1, '600519')).toBe('sh600519')
		expect(eastmoneyToCnCode(0, '000001')).toBe('sz000001')
		expect(eastmoneyToCnCode(0, '830799')).toBe('bj830799')
		expect(eastmoneyToCnCode(0, '920001')).toBe('bj920001')
		expect(eastmoneyToCnCode(0, 'BK0475')).toBeNull()
		const { items, total } = parseEastmoneyBoardStocks({
			data: {
				total: 2,
				diff: [
					{
						f2: 10.5,
						f3: 2.1,
						f6: 1e8,
						f8: 0.5,
						f9: 12.3,
						f12: '600000',
						f13: 1,
						f14: '浦发银行',
						f20: 3e11,
						f62: -2e7,
					},
					{ f2: '-', f3: '-', f12: '000002', f13: 0, f14: '万科A' },
				],
			},
		})
		expect(total).toBe(2)
		expect(items[0]).toMatchObject({ code: 'sh600000', netInflow: -2e7, pe: 12.3, marketCap: 3e11 })
		expect(items[1]).toMatchObject({ code: 'sz000002', price: null, changePct: null })
	})

	test('Naver 业种/主题成分股：原始值字段，KRW', () => {
		const { items, total } = parseNaverGroupStocks({
			totalCount: 175,
			stocks: [
				{
					itemCode: '047920',
					stockName: 'HLB제약',
					closePriceRaw: '13010',
					fluctuationsRatio: '29.97',
					accumulatedTradingValueRaw: '53015000000',
					marketValueRaw: '426700000000',
				},
				{ itemCode: 'bad', stockName: 'x' },
			],
		})
		expect(total).toBe(175)
		expect(items).toEqual([
			{
				code: '047920',
				name: 'HLB제약',
				price: 13010,
				changePct: 29.97,
				amount: 53015000000,
				turnoverRate: null,
				netInflow: null,
				marketCap: 426700000000,
				pe: null,
			},
		])
	})

	test('可排序列只包含有数据的字段', () => {
		const base = {
			code: 'a',
			name: 'a',
			price: 1,
			changePct: 1,
			amount: null,
			turnoverRate: null,
			netInflow: null,
			marketCap: 5,
			pe: null,
		}
		expect(constituentSortKeys([base])).toEqual(['changePct', 'price', 'marketCap'])
	})
})

describe('板块成分股：无数据源的板块给原因，未知代码 400', () => {
	test('港股恒生行业 / 美股 ETF / 日本 ETF → available=false', async () => {
		for (const [m, code] of [
			['hk', 'HSCIIT'],
			['us', 'XLK'],
			['us', 'SMH'],
			['jp', '1617'],
		] as const) {
			const r = await getConstituents(m, code, 'industry')
			expect(r.available).toBe(false)
			expect(r.reason).toBeTruthy()
			expect(r.items).toEqual([])
		}
	})

	test('不在白名单的代码抛 MarketInputError', async () => {
		await expect(getConstituents('us', 'ZZZZ', 'industry')).rejects.toThrow('未知的板块代码')
		await expect(getConstituents('cn', '../x', 'industry')).rejects.toThrow('未知的板块代码')
	})

	test('成分股上限 400（超过取涨幅前 200 + 跌幅前 200）', () => {
		expect(CONSTITUENT_CAP).toBe(400)
	})
})

describe('个股报价解析', () => {
	test('腾讯 qt：A股量手→股、成交额万元→元、市值亿→元、PB 取 46', () => {
		const text = qtLine('sh600519', {
			0: '1',
			1: '贵州茅台',
			2: '600519',
			3: '1258.62',
			4: '1235.58',
			5: '1239.53',
			6: '38331',
			30: '20260930161458',
			31: '23.04',
			32: '1.86',
			33: '1268.00',
			34: '1236.05',
			37: '479725',
			38: '0.31',
			39: '19.32',
			45: '15733.78',
			46: '6.26',
		})
		const [q] = parseTencentStockQt(text)
		expect(q).toMatchObject({
			market: 'cn',
			code: 'sh600519',
			name: '贵州茅台',
			price: 1258.62,
			prevClose: 1235.58,
			change: 23.04,
			changePct: 1.86,
			volume: 3833100,
			amount: 4797250000,
			turnoverRate: 0.31,
			pe: 19.32,
			pb: 6.26,
			marketCap: 1573378000000,
			currency: 'CNY',
			delayMinutes: 0,
		})
		expect(q.quoteTime).toBe(zonedTimeToTs('Asia/Shanghai', 2026, 9, 30, 16, 14, 58))
	})

	test('腾讯 qt：港股换手率取 59、延迟 15 分钟；美股代码大写', () => {
		const text = [
			qtLine('hk00700', {
				1: '腾讯控股',
				3: '428.2',
				4: '423',
				6: '10030081',
				30: '2026/10/06 16:08:08',
				31: '5.2',
				32: '1.23',
				37: '4286181540.58',
				38: '0',
				39: '15.64',
				45: '38934.5372',
				59: '0.11',
			}),
			qtLine('usAAPL', {
				1: '苹果',
				3: '332.89',
				4: '333.69',
				30: '2026-10-05 16:00:02',
				32: '-0.24',
				37: '11469849196',
				38: '0.24',
				45: '48582.5658',
			}),
		].join('\n')
		const [hk, us] = parseTencentStockQt(text)
		expect(hk).toMatchObject({
			market: 'hk',
			code: '00700',
			turnoverRate: 0.11,
			delayMinutes: 15,
			currency: 'HKD',
			pb: null,
		})
		expect(us).toMatchObject({
			market: 'us',
			code: 'AAPL',
			amount: 11469849196,
			delayMinutes: 15,
			currency: 'USD',
		})
		expect(tencentStockCode('hk', '00700')).toBe('hk00700')
		expect(tencentStockCode('us', 'AAPL')).toBe('usAAPL')
		expect(tencentStockCode('cn', 'sz000001')).toBe('sz000001')
	})

	test('腾讯 qt：字段不足或无名称的行跳过', () => {
		expect(parseTencentStockQt('v_sh600000="1~~600000";\nv_pv_none_match="1";')).toEqual([])
	})

	test('Naver polling：昨收 = 现价 - 涨跌；日本去掉 .T', () => {
		const [kr] = parseNaverStockPolling(
			{
				datas: [
					{
						itemCode: '005930',
						stockName: '삼성전자',
						closePriceRaw: '272000',
						compareToPreviousClosePriceRaw: '-4000',
						fluctuationsRatioRaw: '-1.45',
						marketValueFullRaw: '1590187781376000',
						localTradedAt: '2026-10-06T15:30:00+09:00',
						stockExchangeType: { delayTime: 0 },
					},
				],
			},
			'kr',
		)
		expect(kr).toMatchObject({
			code: '005930',
			price: 272000,
			prevClose: 276000,
			marketCap: 1590187781376000,
			delayMinutes: 0,
			currency: 'KRW',
		})
		expect(kr.quoteTime).toBe(Date.parse('2026-10-06T15:30:00+09:00'))
		const [jp] = parseNaverStockPolling(
			{ datas: [{ reutersCode: '7203.T', stockName: '토요타', closePriceRaw: '2930.5' }] },
			'jp',
		)
		expect(jp).toMatchObject({ code: '7203', delayMinutes: 15, currency: 'JPY' })
	})

	test('Naver 日本 basic：优先英文名，带 PER / PBR', () => {
		const q = parseNaverJpBasic(
			{
				stockName: '토요타자동차',
				stockNameEng: 'TOYOTA MOTOR CORPORATION',
				closePriceRaw: '2930.5',
				compareToPreviousClosePriceRaw: '37.0',
				delayTime: 15,
				stockItemTotalInfos: [
					{ code: 'per', value: '8.34배' },
					{ code: 'pbr', value: '0.93배' },
				],
			},
			'7203',
		)
		expect(q).toMatchObject({
			code: '7203',
			name: 'TOYOTA MOTOR CORPORATION',
			prevClose: 2893.5,
			pe: 8.34,
			pb: 0.93,
			delayMinutes: 15,
		})
	})

	test('估值字段：带单位的字符串 / N/A', () => {
		expect(looseNum('12.20배')).toBe(12.2)
		expect(looseNum('1,590조')).toBe(1590)
		expect(looseNum('N/A')).toBeNull()
		expect(parseNaverValuation([{ code: 'per', value: 'N/A' }])).toEqual({ pe: null, pb: null })
	})
})

describe('搜索解析与排序', () => {
	test('腾讯 smartbox：A股/港股/美股，跳过基金和指数，解 \\u 转义', () => {
		const text =
			'v_hint="sh~600519~\\u8d35\\u5dde\\u8305\\u53f0~gzmt~GP-A^sh~688616~\\u897f\\u529b\\u79d1\\u6280~xlkj~GP-A-KCB^sh~510300~\\u6caa\\u6df1300ETF~hs300etf~ETF^hk~00700~\\u817e\\u8baf\\u63a7\\u80a1~txkg~GP^us~aapl.oq~\\u82f9\\u679c~pg~GP^us~brk.b.n~Berkshire~*~GP^jj~007005~\\u57fa\\u91d1~x~KJ^sh~000001~\\u4e0a\\u8bc1\\u6307\\u6570~szzs~ZS"'
		expect(parseTencentSmartbox(text)).toEqual([
			{ market: 'cn', code: 'sh600519', name: '贵州茅台', type: 'stock', exchange: '上交所' },
			{ market: 'cn', code: 'sh688616', name: '西力科技', type: 'stock', exchange: '科创板' },
			{ market: 'cn', code: 'sh510300', name: '沪深300ETF', type: 'etf', exchange: '上交所' },
			{ market: 'hk', code: '00700', name: '腾讯控股', type: 'stock', exchange: '港交所' },
			{ market: 'us', code: 'AAPL', name: '苹果', type: 'stock', exchange: 'NASDAQ' },
			{ market: 'us', code: 'BRK.B', name: 'Berkshire', type: 'stock', exchange: 'NYSE' },
		])
		expect(parseTencentSmartbox('v_hint="N"')).toEqual([])
		expect(parseTencentSmartbox('')).toEqual([])
	})

	test('Naver 自动完成：只要韩国 / 日本个股', () => {
		expect(
			parseNaverAc({
				items: [
					{
						code: '005930',
						name: '삼성전자',
						typeCode: 'KOSPI',
						reutersCode: '005930',
						nationCode: 'KOR',
						category: 'stock',
						url: '/domestic/stock/005930/total',
					},
					{ code: 'TM', name: 'ADR', nationCode: 'USA', category: 'stock', reutersCode: 'TM' },
					{
						code: '7203',
						name: '토요타자동차',
						nationCode: 'JPN',
						reutersCode: '7203.T',
						category: 'stock',
						url: '/worldstock/stock/7203.T/total',
					},
					{ code: 'KOSPI', name: '코스피', nationCode: 'KOR', category: 'index' },
				],
			}),
		).toEqual([
			{ market: 'kr', code: '005930', name: '삼성전자', type: 'stock', exchange: 'KOSPI' },
			{ market: 'jp', code: '7203', name: '토요타자동차', type: 'stock', exchange: '东证' },
		])
	})

	test('排序：代码完全匹配置顶（含 sh/sz 前缀），按市场+代码去重，截断', () => {
		const a = { market: 'cn' as const, code: 'sz000700', name: '模塑科技', type: 'stock' as const }
		const b = { market: 'hk' as const, code: '00700', name: '腾讯控股', type: 'stock' as const }
		const c = { market: 'cn' as const, code: 'sh600519', name: '贵州茅台', type: 'stock' as const }
		expect(rankSearchResults('00700', [[a, b], [b]])).toEqual([b, a])
		expect(rankSearchResults('600519', [[a, c]])[0]).toEqual(c)
		expect(rankSearchResults('x', [[a, b, c]], 2)).toHaveLength(2)
		expect(normalizeQuery('  gz   mt  ')).toBe('gz mt')
		expect(normalizeQuery('x'.repeat(40))).toHaveLength(24)
	})
})

describe('搜索走全局缓存 + 单飞', () => {
	const realFetch = globalThis.fetch
	let calls: string[] = []
	beforeEach(() => {
		__resetMarketCache()
		calls = []
		globalThis.fetch = mock(async (input: string | URL | Request) => {
			const url = String(input)
			calls.push(url)
			await new Promise((r) => setTimeout(r, 20))
			const body = url.includes('smartbox')
				? 'v_hint="sh~600519~\\u8d35\\u5dde\\u8305\\u53f0~gzmt~GP-A"'
				: JSON.stringify({ items: [] })
			return new Response(body, { status: 200 })
		}) as unknown as typeof fetch
	})
	afterEach(() => {
		globalThis.fetch = realFetch
		__resetMarketCache()
	})

	test('并发 5 次 + 再查一次（大小写不同）：每个上游只请求 1 次', async () => {
		const results = await Promise.all(Array.from({ length: 5 }, () => searchStocks('gzmt')))
		await searchStocks('GZMT')
		expect(results[0].items).toEqual([
			{ market: 'cn', code: 'sh600519', name: '贵州茅台', type: 'stock', exchange: '上交所' },
		])
		expect(calls.filter((u) => u.includes('smartbox'))).toHaveLength(1)
		expect(calls.filter((u) => u.includes('ac.stock.naver.com'))).toHaveLength(1)
	})

	test('纯中文不请求 Naver', async () => {
		await searchStocks('茅台')
		expect(calls.some((u) => u.includes('naver'))).toBe(false)
	})

	test('空关键词抛参数错误', async () => {
		await expect(searchStocks('   ')).rejects.toThrow('请输入搜索关键词')
	})
})

describe('自选入参校验', () => {
	test('市场 / 代码格式校验，美股代码转大写，名称截断', () => {
		expect(normalizeStockRef('us', 'aapl', '苹果')).toEqual({
			market: 'us',
			code: 'AAPL',
			name: '苹果',
		})
		expect(normalizeStockRef('cn', '600519')).toBeNull()
		expect(normalizeStockRef('cn', 'sh600519')).toEqual({
			market: 'cn',
			code: 'sh600519',
			name: 'sh600519',
		})
		expect(normalizeStockRef('xx', '1')).toBeNull()
		expect(normalizeStockRef('kr', '005930', 'x'.repeat(200))?.name).toHaveLength(100)
	})

	test('POST body：单个或 items 数组，去重并丢弃非法项', () => {
		expect(sanitizeWatchlistItems({ market: 'hk', code: '00700', name: '腾讯' })).toEqual([
			{ market: 'hk', code: '00700', name: '腾讯' },
		])
		expect(
			sanitizeWatchlistItems({
				items: [
					{ market: 'jp', code: '7203', name: 'Toyota' },
					{ market: 'jp', code: '7203', name: 'dup' },
					{ market: 'kr', code: 'bad' },
					null,
				],
			}),
		).toEqual([{ market: 'jp', code: '7203', name: 'Toyota' }])
		expect(sanitizeWatchlistItems(null)).toEqual([])
	})

	test('GET /quotes 的 items 参数', () => {
		expect(parseStockRefs('cn:sh600519,us:aapl,us:AAPL,kr:005930,bad,xx:1')).toEqual([
			{ market: 'cn', code: 'sh600519' },
			{ market: 'us', code: 'AAPL' },
			{ market: 'kr', code: '005930' },
		])
		expect(parseStockRefs(undefined)).toEqual([])
	})
})

describe('个股分时按交易时段裁剪', () => {
	test('韩国个股：去掉 NXT 盘前 08:xx 和盘后 15:30 之后的点', () => {
		const kr = (h: number, mi: number) => zonedTimeToTs('Asia/Seoul', 2026, 10, 6, h, mi)
		const points: [number, number, number | null][] = [
			[kr(8, 30), 1, 1],
			[kr(9, 0), 2, 1],
			[kr(15, 30), 3, 1],
			[kr(15, 31), 4, 1],
			[kr(18, 0), 5, 1],
		]
		expect(clipToSessions('kr', points).map((p) => p[1])).toEqual([2, 3])
	})
})
