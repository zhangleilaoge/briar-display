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

describe('自选纯函数', () => {
	test('加入去重、追加到末尾，移除按市场+代码', () => {
		let list: WatchlistItem[] = []
		list = addStock(list, maotai, 1)
		list = addStock(list, tencent, 2)
		list = addStock(list, { ...maotai, name: '重复' }, 3)
		expect(list.map((i) => i.code)).toEqual(['sh600519', '00700'])
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

	test('localStorage 解析：坏 JSON / 非数组 / 非法条目丢弃，缺名称用代码', () => {
		expect(parseStoredWatchlist(null)).toEqual([])
		expect(parseStoredWatchlist('{bad')).toEqual([])
		expect(parseStoredWatchlist('{"a":1}')).toEqual([])
		const raw = JSON.stringify([
			{ market: 'us', code: 'AAPL', name: '苹果', addedAt: 5 },
			{ market: 'xx', code: '1' },
			{ market: 'jp', code: '7203' },
			{ market: 'us', code: 'AAPL', name: 'dup' },
			null,
		])
		expect(parseStoredWatchlist(raw)).toEqual([
			{ market: 'us', code: 'AAPL', name: '苹果', addedAt: 5 },
			{ market: 'jp', code: '7203', name: '7203', addedAt: 0 },
		])
	})

	test('登录后合并：只提交服务端没有的', () => {
		const local = [addStock([], maotai, 1)[0], addStock([], tencent, 2)[0]]
		const server = [addStock([], tencent, 9)[0]]
		expect(itemsToImport(local, server)).toEqual([maotai])
		expect(itemsToImport([], server)).toEqual([])
	})
})
