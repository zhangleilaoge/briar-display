import { describe, expect, test } from 'bun:test'
import type { ConstituentItem } from '@briar/shared'
import { displayCode, sortConstituents } from './constituents'
import { nextSort } from './marketUtils'

const item = (
	code: string,
	name: string,
	changePct: number | null,
	pe: number | null = null,
): ConstituentItem => ({
	code,
	name,
	price: 10,
	changePct,
	amount: null,
	turnoverRate: null,
	netInflow: null,
	marketCap: null,
	pe,
})

const list = [
	item('sh600001', '中国', 1.2, 30),
	item('sh600002', '阿里', null, 12),
	item('sh600003', '贵州', 3.5, null),
	item('sh600004', '比亚', -2, 8),
]

describe('成分股排序', () => {
	test('涨跌幅降序 / 升序，空值始终最后', () => {
		expect(sortConstituents(list, 'changePct', 'desc').map((i) => i.code)).toEqual([
			'sh600003',
			'sh600001',
			'sh600004',
			'sh600002',
		])
		expect(sortConstituents(list, 'changePct', 'asc').map((i) => i.code)).toEqual([
			'sh600004',
			'sh600001',
			'sh600003',
			'sh600002',
		])
	})

	test('市盈率升序：空值仍在最后', () => {
		expect(sortConstituents(list, 'pe', 'asc').map((i) => i.pe)).toEqual([8, 12, 30, null])
	})

	test('名称按中文 zh-CN 排序', () => {
		expect(sortConstituents(list, 'name', 'asc').map((i) => i.name)).toEqual([
			'阿里',
			'比亚',
			'贵州',
			'中国',
		])
		expect(sortConstituents(list, 'name', 'desc').map((i) => i.name)).toEqual([
			'中国',
			'贵州',
			'比亚',
			'阿里',
		])
	})

	test('表头点击：新列先降序，同列切换（与板块列表同一个 nextSort）', () => {
		expect(nextSort({ key: 'changePct', direction: 'desc' }, 'pe')).toEqual({
			key: 'pe',
			direction: 'desc',
		})
		expect(nextSort({ key: 'pe', direction: 'desc' }, 'pe')).toEqual({
			key: 'pe',
			direction: 'asc',
		})
	})

	test('不改原数组；A股代码展示去掉交易所前缀', () => {
		const copy = [...list]
		sortConstituents(list, 'changePct')
		expect(list).toEqual(copy)
		expect(displayCode('sh600519')).toBe('600519')
		expect(displayCode('00700')).toBe('00700')
		expect(displayCode('AAPL')).toBe('AAPL')
	})
})
