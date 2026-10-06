import { describe, expect, test } from 'bun:test'
import {
	type DetailView,
	backLabel,
	openStack,
	popView,
	pushView,
	topView,
	viewKey,
	viewTitle,
} from './dialogStack'

const sector: DetailView = {
	kind: 'chart',
	market: 'cn',
	sectorKind: 'industry',
	subject: { target: 'sector', code: 'pt01801150', name: '医药生物' },
}
const stockA: DetailView = {
	kind: 'stock',
	market: 'cn',
	stock: { market: 'cn', code: 'sh688185', name: '康希诺' },
}
const stockB: DetailView = {
	kind: 'stock',
	market: 'cn',
	stock: { market: 'cn', code: 'sh600276', name: '恒瑞医药' },
}

describe('详情弹窗导航栈', () => {
	test('打开即一层；null 为关闭', () => {
		expect(openStack(sector)).toEqual([sector])
		expect(openStack(null)).toEqual([])
		expect(topView([])).toBeNull()
	})

	test('板块 → 个股 → 返回：标题随栈顶变化，返回按钮显示上一层名称', () => {
		let stack = openStack(sector)
		expect(backLabel(stack)).toBeNull()
		stack = pushView(stack, stockA)
		expect(topView(stack)).toBe(stockA)
		expect(viewTitle(topView(stack) as DetailView)).toEqual({
			title: '康希诺',
			subTitle: 'sh688185',
		})
		expect(backLabel(stack)).toBe('返回 医药生物')
		stack = popView(stack)
		expect(stack).toEqual([sector])
		expect(viewTitle(sector).title).toBe('医药生物')
	})

	test('重复点同一只不重复压栈；点栈里已有的层回到那一层', () => {
		let stack = pushView(openStack(sector), stockA)
		expect(pushView(stack, stockA)).toEqual([sector, stockA])
		stack = pushView(stack, stockB)
		expect(stack).toHaveLength(3)
		expect(pushView(stack, stockA)).toEqual([sector, stockA])
		expect(pushView(stack, sector)).toEqual([sector])
	})

	test('只剩一层时返回不动（关闭交给弹窗）', () => {
		expect(popView([sector])).toEqual([sector])
	})

	test('key 区分目标类型与市场', () => {
		expect(viewKey(sector)).toBe('sector:cn:pt01801150')
		expect(viewKey(stockA)).toBe('stock:cn:sh688185')
		expect(
			viewKey({ ...stockA, market: 'hk', stock: { market: 'hk', code: '00700', name: 'x' } }),
		).toBe('stock:hk:00700')
	})
})
