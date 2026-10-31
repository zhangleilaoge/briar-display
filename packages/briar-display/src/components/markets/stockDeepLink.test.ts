import { describe, expect, test } from 'bun:test'
import type { StockRef } from '@briar/shared'
import { parseStockDeepLink, stockDeepLinkHref } from './stockDeepLink'

describe('股票小组件深链', () => {
	test('保留市场、代码、名称和标的类型', () => {
		const stock: StockRef = { market: 'hk', code: '01810', name: '小米集团-W', type: 'stock' }
		const url = new URL(stockDeepLinkHref(stock), 'https://xiaobuzi.cn')
		expect(url.pathname).toBe('/briar/markets')
		expect(parseStockDeepLink(url.search)).toEqual(stock)
	})

	test('缺省名称回退代码，非法类型回退个股', () => {
		expect(parseStockDeepLink('?market=us&code=AAPL&type=unknown')).toEqual({
			market: 'us',
			code: 'AAPL',
			name: 'AAPL',
			type: 'stock',
		})
	})

	test('拒绝缺代码、空代码和未知市场', () => {
		for (const search of ['?market=hk', '?market=hk&code=%20', '?market=unknown&code=01810']) {
			expect(parseStockDeepLink(search)).toBeNull()
		}
	})
})
