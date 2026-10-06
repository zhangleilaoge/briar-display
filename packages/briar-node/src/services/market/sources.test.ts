import { describe, expect, test } from 'bun:test'
import {
	num,
	parseEastmoneyBoards,
	parseEastmoneyUlist,
	parseNaverGroups,
	parseNaverIndexTrend,
	parseNaverPolling,
	parseTencentBoards,
	parseTencentQt,
} from './sources'

describe('行情源解析', () => {
	test('num 兼容千分位 / 占位符', () => {
		expect(num('1,234.5')).toBe(1234.5)
		expect(num('-')).toBeNull()
		expect(num('')).toBeNull()
		expect(num(undefined)).toBeNull()
		expect(num(3)).toBe(3)
	})

	test('腾讯板块：成交额/主力净流入万元换算、上涨家数、领涨股', () => {
		const { items, total } = parseTencentBoards({
			code: 0,
			data: {
				total: 31,
				rank_list: [
					{
						code: 'pt01801150',
						name: '医药生物',
						zxj: '7989.12',
						zdf: '2.73',
						turnover: '13828968',
						hsl: '2.54',
						zljlr: '602408.25',
						zgb: '403/480',
						lzg: { code: 'sh688185', name: '康希诺', zdf: '20.00' },
					},
				],
			},
		})
		expect(total).toBe(31)
		expect(items[0]).toMatchObject({
			code: 'pt01801150',
			changePct: 2.73,
			amount: 138289680000,
			netInflow: 6024082500,
			turnoverRate: 2.54,
			upCount: 403,
			total: 480,
			leader: { name: '康希诺', changePct: 20 },
		})
		expect(() => parseTencentBoards({ code: 1, msg: 'count too large' })).toThrow()
	})

	test('东财板块：按 f111 过滤行业分级', () => {
		const json = {
			data: {
				total: 2,
				diff: [
					{
						f12: 'BK0438',
						f14: '食品饮料',
						f3: 1.51,
						f6: 2.5e10,
						f8: 1.45,
						f62: 1.4e9,
						f111: 2,
						f128: '均瑶健康',
						f136: 9.97,
						f140: '605388',
						f104: 107,
						f105: 15,
					},
					{
						f12: 'BK1277',
						f14: '白酒Ⅱ',
						f3: 2.79,
						f6: 1e10,
						f8: 1,
						f62: '-',
						f111: 4,
						f128: '-',
						f136: '-',
					},
				],
			},
		}
		const level1 = parseEastmoneyBoards(json, '1')
		expect(level1.map((i) => i.name)).toEqual(['食品饮料'])
		expect(level1[0]).toMatchObject({ upCount: 107, downCount: 15, leader: { name: '均瑶健康' } })
		const level2 = parseEastmoneyBoards(json, '2')
		expect(level2[0]).toMatchObject({ name: '白酒Ⅱ', netInflow: null, leader: null })
	})

	test('东财 ulist：secid 与秒级时间戳', () => {
		const rows = parseEastmoneyUlist({
			data: {
				diff: [
					{
						f2: 24229.86,
						f3: 0.79,
						f4: 189.52,
						f6: '-',
						f12: 'HSI',
						f13: 100,
						f14: '恒生指数',
						f62: '-',
						f124: 1791269828,
					},
					{ f2: 200.93, f12: 'XLK', f13: 107, f14: 'XLK', f62: 22346310.0 },
				],
			},
		})
		expect(rows[0]).toMatchObject({
			key: '100.HSI',
			changePct: 0.79,
			amount: null,
			quoteTime: 1791269828000,
			netInflow: null,
		})
		// 东财 f62 主力净流入：港股指数为 "-"，美股 ETF 有值
		expect(rows[1].netInflow).toBe(22346310)
	})

	test('Naver 韩国指数投资者动向：억원 → 元，带正负号', () => {
		expect(
			parseNaverIndexTrend({
				bizdate: '20261006',
				personalValue: '+7,545',
				foreignValue: '-17,665',
				institutionalValue: '-35',
			}),
		).toEqual({
			date: '20261006',
			foreign: -17665e8,
			institutional: -35e8,
			personal: 7545e8,
		})
	})

	test('腾讯 qt：GBK 解码后的 ~ 分隔文本，美股时间按美东解析', () => {
		const f = Array.from({ length: 40 }, () => '0')
		f[1] = '科技行业精选ETF-SPDR'
		f[3] = '200.93'
		f[30] = '2026-10-05 16:00:01'
		f[31] = '1.12'
		f[32] = '0.56'
		f[37] = '1323759404'
		const text = `v_usXLK="${f.join('~')}";\nv_pv_none_match="1";`
		const rows = parseTencentQt(text)
		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({
			key: 'usXLK',
			code: 'XLK',
			changePct: 0.56,
			amount: 1323759404,
		})
		expect(new Date(rows[0].quoteTime as number).toISOString()).toBe('2026-10-05T20:00:01.000Z')
	})

	test('Naver 业种：中文翻译保留韩文原名，未收录的原样显示', () => {
		const { items, total } = parseNaverGroups(
			{
				totalCount: 79,
				groups: [
					{
						no: 287,
						name: '소프트웨어',
						totalCount: 74,
						changeRate: '7.05',
						riseCount: 50,
						fallCount: 16,
					},
					{ no: 999, name: '신규업종', changeRate: '-1.2' },
				],
			},
			{ 소프트웨어: '软件' },
		)
		expect(total).toBe(79)
		expect(items[0]).toMatchObject({
			code: '287',
			name: '软件',
			rawName: '소프트웨어',
			upCount: 50,
			downCount: 16,
			total: 74,
		})
		expect(items[1]).toMatchObject({ name: '신규업종', changePct: -1.2 })
		expect(items[1].rawName).toBeUndefined()
	})

	test('Naver 轮询：延迟分钟数与带时区的本地时间', () => {
		const rows = parseNaverPolling({
			datas: [
				{
					reutersCode: '1617.T',
					stockName: 'Nomura NF TOPIX-17 Foods ETF',
					closePriceRaw: '47780.0',
					fluctuationsRatioRaw: '-0.19',
					accumulatedTradingValueRaw: '19396000',
					localTradedAt: '2026-10-06T15:30:00+09:00',
					stockExchangeType: { delayTime: 15 },
				},
			],
		})
		expect(rows[0]).toMatchObject({
			code: '1617.T',
			changePct: -0.19,
			amount: 19396000,
			delayMinutes: 15,
		})
		expect(new Date(rows[0].quoteTime as number).toISOString()).toBe('2026-10-06T06:30:00.000Z')
	})
})
