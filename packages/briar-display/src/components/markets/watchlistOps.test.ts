import { describe, expect, test } from 'bun:test'
import { WATCHLIST_LIMIT, type WatchlistItem } from '@briar/shared'
import {
	addStock,
	hasStock,
	itemsToImport,
	parseStoredWatchlist,
	removeStock,
} from './watchlistOps'

const maotai = { market: 'cn' as const, code: 'sh600519', name: '贵州茅台' }
const tencent = { market: 'hk' as const, code: '00700', name: '腾讯控股' }
const shanghai = {
	market: 'cn' as const,
	code: 'sh000001',
	name: '上证指数',
	type: 'index' as const,
}

describe('自选纯函数', () => {
	test('加入去重、追加到末尾，移除按市场+代码', () => {
		let list: WatchlistItem[] = []
		list = addStock(list, maotai, 1)
		list = addStock(list, tencent, 2)
		list = addStock(list, { ...maotai, name: '重复' }, 3)
		expect(list.map((i) => i.code)).toEqual(['sh600519', '00700'])
		expect(list.every((i) => i.type === 'stock')).toBe(true)
		expect(hasStock(list, { market: 'cn', code: 'sh600519' })).toBe(true)
		// 同代码不同市场不算同一只
		expect(hasStock(list, { market: 'us', code: 'sh600519' })).toBe(false)
		expect(removeStock(list, tencent).map((i) => i.code)).toEqual(['sh600519'])
	})

	test('超过上限不再加入', () => {
		let list: WatchlistItem[] = []
		for (let i = 0; i < WATCHLIST_LIMIT + 5; i++) {
			list = addStock(list, { market: 'kr', code: String(i).padStart(6, '0'), name: `${i}` })
		}
		expect(list).toHaveLength(WATCHLIST_LIMIT)
	})

	test('localStorage 解析：坏数据丢弃，旧条目默认个股，指数保留类型', () => {
		expect(parseStoredWatchlist(null)).toEqual([])
		expect(parseStoredWatchlist('{bad')).toEqual([])
		expect(parseStoredWatchlist('{"a":1}')).toEqual([])
		const raw = JSON.stringify([
			{ market: 'us', code: 'AAPL', name: '苹果', addedAt: 5 },
			{ market: 'xx', code: '1' },
			{ market: 'jp', code: '7203' },
			{ ...shanghai, addedAt: 7 },
			{ market: 'us', code: 'AAPL', name: 'dup' },
			null,
		])
		expect(parseStoredWatchlist(raw)).toEqual([
			{ market: 'us', code: 'AAPL', name: '苹果', type: 'stock', addedAt: 5 },
			{ market: 'jp', code: '7203', name: '7203', type: 'stock', addedAt: 0 },
			{ ...shanghai, addedAt: 7 },
		])
	})

	test('登录后合并：只提交服务端没有的，指数类型不丢失', () => {
		const local = [
			addStock([], maotai, 1)[0],
			addStock([], tencent, 2)[0],
			addStock([], shanghai, 3)[0],
		]
		const server = [addStock([], tencent, 9)[0]]
		expect(itemsToImport(local, server)).toEqual([{ ...maotai, type: 'stock' }, shanghai])
		expect(itemsToImport([], server)).toEqual([])
	})
})
