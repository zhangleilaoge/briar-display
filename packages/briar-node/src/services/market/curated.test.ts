import { describe, expect, test } from 'bun:test'
import { isStockCode } from '@briar/shared'
import type { StockQuote } from '@briar/shared'
import { type CuratedSectorDef, HK_CONCEPT_SECTORS, US_CONCEPT_SECTORS } from './catalog'
import { buildCuratedConstituents, buildCuratedSectorItems, curatedMembers } from './curated'

const quote = (
	market: 'hk' | 'us',
	code: string,
	changePct: number | null,
	amount = 0,
): StockQuote => ({
	market,
	code,
	name: `${code} 名称`,
	price: 10,
	change: 0,
	changePct,
	prevClose: 10,
	open: 10,
	high: 10,
	low: 10,
	amount,
	volume: 0,
	turnoverRate: 1,
	marketCap: 1e10,
	pe: 20,
	pb: null,
	currency: market === 'hk' ? 'HKD' : 'USD',
	quoteTime: null,
	delayMinutes: 15,
	source: '腾讯行情 qt',
})

const DEFS: CuratedSectorDef[] = [
	{
		code: 'demo',
		name: '示例题材',
		members: [
			{ market: 'us', code: 'AAPL' },
			{ market: 'us', code: 'MSFT' },
			{ market: 'us', code: 'XYZ' },
		],
	},
]

describe('题材板块聚合', () => {
	test('板块条目：涨跌幅等权平均、成交额求和、涨跌家数、领涨股', () => {
		const quotes = new Map<string, StockQuote>([
			['us:AAPL', quote('us', 'AAPL', 2, 100)],
			['us:MSFT', quote('us', 'MSFT', -1, 300)],
			// XYZ 无报价：不参与平均，total 仍按名单数
		])
		const [item] = buildCuratedSectorItems(DEFS, quotes)
		expect(item.changePct).toBe(0.5)
		expect(item.amount).toBe(400)
		expect(item.upCount).toBe(1)
		expect(item.downCount).toBe(1)
		expect(item.total).toBe(3)
		expect(item.leader).toEqual({ name: 'AAPL 名称', code: 'AAPL', changePct: 2 })
		expect(item.price).toBeNull()
		expect(item.netInflow).toBeNull()
	})

	test('板块条目：全部无报价时涨跌幅 / 成交额 / 领涨股为空', () => {
		const [item] = buildCuratedSectorItems(DEFS, new Map())
		expect(item.changePct).toBeNull()
		expect(item.amount).toBeNull()
		expect(item.leader).toBeNull()
		expect(item.upCount).toBe(0)
	})

	test('成分股：报价缺失时字段留空、名称回退代码', () => {
		const [aapl, , xyz] = buildCuratedConstituents(
			DEFS[0],
			new Map([['us:AAPL', quote('us', 'AAPL', 1)]]),
		)
		expect(aapl).toMatchObject({ code: 'AAPL', name: 'AAPL 名称', changePct: 1, pe: 20 })
		expect(xyz).toMatchObject({ code: 'XYZ', name: 'XYZ', price: null, changePct: null })
	})

	test('curatedMembers：跨板块去重（真实名单）', () => {
		const members = curatedMembers('us')
		// NVDA 同时出现在 AI 算力等多个题材，去重后只出现一次
		expect(members.filter((m) => m.code === 'NVDA')).toHaveLength(1)
		const ids = members.map((m) => `${m.market}:${m.code}`)
		expect(new Set(ids).size).toBe(ids.length)
	})
})

describe('题材板块名单完整性', () => {
	test('代码符合各市场格式、板块 code 不重复、成员不重复', () => {
		for (const defs of [US_CONCEPT_SECTORS, HK_CONCEPT_SECTORS]) {
			const codes = defs.map((d) => d.code)
			expect(new Set(codes).size).toBe(codes.length)
			for (const def of defs) {
				const members = def.members.map((m) => `${m.market}:${m.code}`)
				expect(new Set(members).size).toBe(members.length)
				for (const m of def.members) {
					expect(m.market === 'us' || m.market === 'hk').toBe(true)
					expect(isStockCode(m.market, m.code)).toBe(true)
				}
			}
		}
		// 两个市场 slug 相同（如 ai-compute）属于正常复用，成员按各自市场解释
	})
})
