import { MARKET_IDS, type MarketId, type StockRef, isStockType } from '@briar/shared'

export function stockDeepLinkHref(stock: StockRef): string {
	const params = new URLSearchParams({
		market: stock.market,
		code: stock.code,
		name: stock.name,
		type: stock.type ?? 'stock',
	})
	return `/briar/markets?${params.toString()}`
}

export function parseStockDeepLink(search: string): StockRef | null {
	const params = new URLSearchParams(search)
	const market = params.get('market')
	const code = params.get('code')?.trim()
	if (!code || !market || !(MARKET_IDS as readonly string[]).includes(market)) return null
	const type = params.get('type')
	return {
		market: market as MarketId,
		code,
		name: params.get('name')?.trim() || code,
		type: isStockType(type) ? type : 'stock',
	}
}
