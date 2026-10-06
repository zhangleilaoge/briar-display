import { type MarketId, WATCHLIST_LIMIT, isMarketId, isStockCode } from '@briar/shared'

/** 自选 / 批量报价的入参校验（纯函数，路由层用，便于单测） */

export interface StockRefInput {
	market: MarketId
	code: string
	name: string
}

/** 美股代码统一大写，其余原样；不合法返回 null */
export function normalizeStockRef(
	market: unknown,
	code: unknown,
	name?: unknown,
): StockRefInput | null {
	if (typeof market !== 'string' || !isMarketId(market) || typeof code !== 'string') return null
	const c = market === 'us' ? code.trim().toUpperCase() : code.trim()
	if (!isStockCode(market, c)) return null
	const n = typeof name === 'string' ? name.trim().slice(0, 100) : ''
	return { market, code: c, name: n || c }
}

/** POST /watchlist 的 body：{ items: [{ market, code, name }] } 或单个 { market, code, name } */
export function sanitizeWatchlistItems(body: unknown): StockRefInput[] {
	if (!body || typeof body !== 'object') return []
	const raw = Array.isArray((body as { items?: unknown }).items)
		? ((body as { items: unknown[] }).items as unknown[])
		: [body]
	const seen = new Set<string>()
	const out: StockRefInput[] = []
	for (const r of raw.slice(0, WATCHLIST_LIMIT)) {
		const o = r as Record<string, unknown> | null
		const ref = o ? normalizeStockRef(o.market, o.code, o.name) : null
		if (!ref) continue
		const id = `${ref.market}:${ref.code}`
		if (seen.has(id)) continue
		seen.add(id)
		out.push(ref)
	}
	return out
}

/** GET /quotes?items=cn:sh600519,us:AAPL → 合法的引用（去重，最多 WATCHLIST_LIMIT 个） */
export function parseStockRefs(raw: string | undefined): Omit<StockRefInput, 'name'>[] {
	if (!raw) return []
	const seen = new Set<string>()
	const out: Omit<StockRefInput, 'name'>[] = []
	for (const part of raw.split(',')) {
		const idx = part.indexOf(':')
		if (idx <= 0) continue
		const ref = normalizeStockRef(part.slice(0, idx), part.slice(idx + 1))
		if (!ref) continue
		const id = `${ref.market}:${ref.code}`
		if (seen.has(id)) continue
		seen.add(id)
		out.push({ market: ref.market, code: ref.code })
		if (out.length >= WATCHLIST_LIMIT) break
	}
	return out
}
