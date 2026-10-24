import { describe, expect, test } from 'bun:test'
import type { IndexDef } from './catalog'
import {
	JPX_QUOTE_TARGETS,
	type JpxQuoteTarget,
	parseHsiQuote,
	parseJpxQuotes,
	parseJpxTime,
	parseSinaNikkei,
} from './officialSources'

const hsiDef: IndexDef = {
	em: '100.HSI',
	hsi: { series: 'hsi', code: '00001.00' },
	name: '恒生指数',
}

const topixTarget: JpxQuoteTarget = {
	code: '.TOPX',
	group: 'main',
	key: 'Topix',
	qcode: '151',
}

describe('官方及低延迟指数报价解析', () => {
	test('恒指官网：按指数代码选择，保留原指数标识和香港时间', () => {
		const row = parseHsiQuote(
			{
				code: '0',
				data: [
					{ indexCode: '00001.01', indexValue: '1' },
					{
						indexCode: '00001.00',
						indexShortName: 'HSI',
						indexValue: '23093.37',
						changeValue: '+158.69',
						changePercentage: '+0.69',
						indexTime: '2026-10-23 16:08:30',
					},
				],
			},
			hsiDef,
		)
		expect(row).toMatchObject({
			key: 'hsi:hsi',
			code: '100.HSI',
			price: 23093.37,
			change: 158.69,
			changePct: 0.69,
			amount: null,
			delayMinutes: 0,
		})
		expect(new Date(row.quoteTime as number).toISOString()).toBe('2026-10-23T08:08:30.000Z')
	})

	test('恒指官网：错误状态、代码不匹配和缺失行情时间均失败', () => {
		expect(() => parseHsiQuote({ code: '1', message: 'bad request' }, hsiDef)).toThrow(
			'bad request',
		)
		expect(() => parseHsiQuote({ code: '0', data: [] }, hsiDef)).toThrow('not found')
		expect(() =>
			parseHsiQuote(
				{
					code: '0',
					data: [{ indexCode: '00001.00', indexValue: '23093.37' }],
				},
				hsiDef,
			),
		).toThrow('invalid price or quote time')
	})

	test('JPX：TOPIX 与行业共享东京行情时间，不返回 ETF 成交额', () => {
		const industryTarget: JpxQuoteTarget = {
			code: '1617',
			group: 'industry',
			key: 'Topix17Food',
			qcode: '271',
		}
		const rows = parseJpxQuotes(
			{
				MainStockIndex: {
					Topix: {
						marketName: 'TOPIX',
						currentPrice: '3,965.81',
						previousDayComparison: '-31.69',
						previousDayRatio: '-0.79',
						RealtimeGraphURL: 'https://quote.jpx.co.jp/?qcode=151',
					},
				},
				IndustryTypeStockIndex: {
					Topix17Food: {
						marketName: 'TOPIX-17 FOODS',
						currentPrice: '514.60',
						previousDayComparison: '3.26',
						previousDayRatio: '0.64',
						RealtimeGraphURL: 'https://quote.jpx.co.jp/?qcode=271',
					},
				},
			},
			'202610231659',
			[topixTarget, industryTarget],
		)
		expect(rows.map((row) => row.code)).toEqual(['.TOPX', '1617'])
		expect(rows[0]).toMatchObject({ price: 3965.81, change: -31.69, changePct: -0.79 })
		expect(rows[1]).toMatchObject({ price: 514.6, change: 3.26, changePct: 0.64, amount: null })
		expect(new Date(rows[0].quoteTime as number).toISOString()).toBe('2026-10-23T07:59:00.000Z')
		expect(parseJpxTime('bad')).toBeNull()
	})

	test('JPX：qcode 误配、无报价及非法时间不会成为有效行情', () => {
		const snapshot = {
			MainStockIndex: {
				Topix: {
					currentPrice: '3965.81',
					RealtimeGraphURL: 'https://quote.jpx.co.jp/?qcode=999',
				},
			},
		}
		expect(() => parseJpxQuotes(snapshot, '202610231659', [topixTarget])).toThrow(
			'no configured indices',
		)
		expect(() => parseJpxQuotes({}, 'bad', [topixTarget])).toThrow('invalid quote time')
	})

	test('JPX 目录：TOPIX + 17 个真实行业指数，保留旧外部代码', () => {
		expect(JPX_QUOTE_TARGETS).toHaveLength(18)
		const industries = JPX_QUOTE_TARGETS.filter((target) => target.group === 'industry')
		expect(industries[0]).toMatchObject({ code: '1617', key: 'Topix17Food', qcode: '271' })
		expect(industries.at(-1)).toMatchObject({
			code: '1633',
			key: 'Topix17RealEstate',
			qcode: '287',
		})
	})

	test('新浪日经：使用 znb_NKY 的正确字段和北京时间', () => {
		const row = parseSinaNikkei(
			'var hq_str_znb_NKY="日经225,62692.9400,-214.90,-0.34,2:12 AM,1759126320,2026-10-23,14:30:01,62667.0500,62907.8400,62786.8900,61462.6100,0";',
		)
		expect(row).toMatchObject({
			key: 'sina:znb_NKY',
			code: '100.N225',
			price: 62692.94,
			change: -214.9,
			changePct: -0.34,
			delayMinutes: 0,
		})
		expect(new Date(row.quoteTime as number).toISOString()).toBe('2026-10-23T06:30:01.000Z')
		expect(() => parseSinaNikkei('var hq_str_znb_NKY="";')).toThrow()
		expect(() => parseSinaNikkei('var hq_str_int_nikkei="44946.64";')).toThrow()
	})
})
