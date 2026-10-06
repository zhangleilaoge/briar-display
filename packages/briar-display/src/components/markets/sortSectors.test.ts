import { describe, expect, test } from 'bun:test'
import type { SectorItem } from '@briar/shared'
import { availableSortKeys, nextSort, sortSectors, sortValue } from './marketUtils'

const item = (code: string, name: string, patch: Partial<SectorItem> = {}): SectorItem => ({
	code,
	name,
	price: null,
	changePct: null,
	amount: null,
	netInflow: null,
	turnoverRate: null,
	upCount: null,
	downCount: null,
	total: null,
	leader: null,
	...patch,
})

const codes = (items: SectorItem[]) => items.map((i) => i.code)

describe('板块排序', () => {
	const items = [
		item('a', '银行', { changePct: 1.2, netInflow: -5e8, upCount: 30, total: 42 }),
		item('b', '半导体', { changePct: -0.5, netInflow: 3e8, upCount: 10, total: 100 }),
		item('c', '电力', { changePct: null, netInflow: null }),
		item('d', '传媒', { changePct: 3.1, netInflow: 1e8, upCount: 5, total: 5 }),
	]

	test('数值列降序 / 升序，空值无论方向都排最后', () => {
		expect(codes(sortSectors(items, 'changePct', 'desc'))).toEqual(['d', 'a', 'b', 'c'])
		expect(codes(sortSectors(items, 'changePct', 'asc'))).toEqual(['b', 'a', 'd', 'c'])
		expect(codes(sortSectors(items, 'netInflow', 'desc'))).toEqual(['b', 'd', 'a', 'c'])
		expect(codes(sortSectors(items, 'netInflow', 'asc'))).toEqual(['a', 'd', 'b', 'c'])
	})

	test('涨跌家数按上涨占比，领涨股按领涨股涨幅', () => {
		expect(sortValue(items[0], 'breadth')).toBeCloseTo(30 / 42)
		expect(codes(sortSectors(items, 'breadth', 'desc'))).toEqual(['d', 'a', 'b', 'c'])
		const withLeader = [
			item('x', 'X', { leader: { name: '甲', changePct: 9.98 } }),
			item('y', 'Y', { leader: { name: '乙', changePct: 20 } }),
			item('z', 'Z', { leader: null }),
		]
		expect(codes(sortSectors(withLeader, 'leaderPct', 'desc'))).toEqual(['y', 'x', 'z'])
		expect(codes(sortSectors(withLeader, 'leaderPct', 'asc'))).toEqual(['x', 'y', 'z'])
	})

	test('名称按中文 localeCompare(zh-CN)（拼音序）', () => {
		const asc = sortSectors(items, 'name', 'asc').map((i) => i.name)
		expect(asc).toEqual([...items.map((i) => i.name)].sort((a, b) => a.localeCompare(b, 'zh-CN')))
		expect(sortSectors(items, 'name', 'desc').map((i) => i.name)).toEqual([...asc].reverse())
	})

	test('不修改原数组', () => {
		const before = codes(items)
		sortSectors(items, 'changePct', 'asc')
		expect(codes(items)).toEqual(before)
	})

	test('表头点击：新列先降序，再点同列切升序，再点回降序', () => {
		let s = nextSort({ key: 'changePct', direction: 'desc' }, 'amount')
		expect(s).toEqual({ key: 'amount', direction: 'desc' })
		s = nextSort(s, 'amount')
		expect(s).toEqual({ key: 'amount', direction: 'asc' })
		expect(nextSort(s, 'amount')).toEqual({ key: 'amount', direction: 'desc' })
	})

	test('可排序维度：后端 sortKeys + 有数据的前端维度 + 名称；无数据的不出现', () => {
		expect(availableSortKeys(items, ['changePct', 'netInflow'])).toEqual([
			'changePct',
			'netInflow',
			'breadth',
			'name',
		])
		// 韩国主题：只有涨跌幅，无资金流 / 领涨股
		expect(availableSortKeys([item('k', '반도체', { changePct: 1 })], ['changePct'])).toEqual([
			'changePct',
			'name',
		])
	})
})
