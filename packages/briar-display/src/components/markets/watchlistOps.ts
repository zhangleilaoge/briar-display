import {
	MARKET_IDS,
	type MarketId,
	type StockRef,
	WATCHLIST_LIMIT,
	type WatchlistItem,
} from '@briar/shared'

/** 自选的纯函数操作（store 和单测共用） */

export const WATCHLIST_STORAGE_KEY = 'briar_market_watchlist'

export const stockId = (s: Pick<StockRef, 'market' | 'code'>) => `${s.market}:${s.code}`

export const hasStock = (list: WatchlistItem[], s: Pick<StockRef, 'market' | 'code'>) =>
	list.some((i) => stockId(i) === stockId(s))

/** 加到末尾；已存在或超过上限不变 */
export function addStock(list: WatchlistItem[], s: StockRef, now = Date.now()): WatchlistItem[] {
	if (hasStock(list, s) || list.length >= WATCHLIST_LIMIT) return list
	return [...list, { market: s.market, code: s.code, name: s.name, addedAt: now }]
}

export const removeStock = (list: WatchlistItem[], s: Pick<StockRef, 'market' | 'code'>) =>
	list.filter((i) => stockId(i) !== stockId(s))

const isMarket = (v: unknown): v is MarketId =>
	typeof v === 'string' && (MARKET_IDS as readonly string[]).includes(v)

/** localStorage 里的值可能被手改 / 旧版本：逐条校验，坏数据丢弃 */
export function parseStoredWatchlist(raw: string | null): WatchlistItem[] {
	if (!raw) return []
	try {
		const data = JSON.parse(raw)
		if (!Array.isArray(data)) return []
		let list: WatchlistItem[] = []
		for (const r of data) {
			if (!r || !isMarket(r.market) || typeof r.code !== 'string' || !r.code) continue
			const name = typeof r.name === 'string' && r.name ? r.name : r.code
			list = addStock(list, { market: r.market, code: r.code, name }, Number(r.addedAt) || 0)
		}
		return list
	} catch {
		return []
	}
}

/** 访客自选登录后要合并到服务端的条目（服务端已有的不再提交） */
export const itemsToImport = (local: WatchlistItem[], server: WatchlistItem[]) =>
	local
		.filter((i) => !hasStock(server, i))
		.map(({ market, code, name }) => ({ market, code, name }))
