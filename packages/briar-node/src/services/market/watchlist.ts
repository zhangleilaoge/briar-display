import {
	type MarketId,
	type StockType,
	WATCHLIST_LIMIT,
	isMarketId,
	isStockCode,
	isStockType,
} from '@briar/shared'

/** 自选 / 批量报价的入参校验（纯函数，路由层用，便于单测） */

export interface StockRefInput {
	market: MarketId
	code: string
	name: string
	type: StockType
}

/** 美股代码统一大写，其余原样；不合法返回 null */
export function normalizeStockRef(
	market: unknown,
	code: unknown,
	name?: unknown,
	type?: unknown,
): StockRefInput | null {
	if (typeof market !== 'string' || !isMarketId(market) || typeof code !== 'string') return null
	const c = market === 'us' ? code.trim().toUpperCase() : code.trim()
	const kind = type === undefined ? 'stock' : type
	if (!isStockCode(market, c) || !isStockType(kind)) return null
	if (kind === 'index' && (market !== 'cn' || !/^(sh|sz)\d{6}$/.test(c))) return null
	const n = typeof name === 'string' ? name.trim().slice(0, 100) : ''
	return { market, code: c, name: n || c, type: kind }
}

/** POST /watchlist 的 body：{ items: [{ market, code, name, type }] } 或单个标的 */
export function sanitizeWatchlistItems(body: unknown): StockRefInput[] {
	if (!body || typeof body !== 'object') return []
	const raw = Array.isArray((body as { items?: unknown }).items)
		? ((body as { items: unknown[] }).items as unknown[])
		: [body]
	const seen = new Set<string>()
	const out: StockRefInput[] = []
	for (const r of raw.slice(0, WATCHLIST_LIMIT)) {
		const o = r as Record<string, unknown> | null
		const ref = o ? normalizeStockRef(o.market, o.code, o.name, o.type) : null
		if (!ref) continue
		const id = `${ref.market}:${ref.code}`
		if (seen.has(id)) continue
		seen.add(id)
		out.push(ref)
	}
	return out
}

/** GET items 兼容 market:code 与 market:type:code，去重后最多 WATCHLIST_LIMIT 个 */
export function parseStockRefs(raw: string | undefined): Omit<StockRefInput, 'name'>[] {
	if (!raw) return []
	const seen = new Set<string>()
	const out: Omit<StockRefInput, 'name'>[] = []
	for (const part of raw.split(',')) {
		const fields = part.split(':')
		if (fields.length !== 2 && fields.length !== 3) continue
		const [market, second, third] = fields
		const ref = normalizeStockRef(
			market,
			fields.length === 3 ? third : second,
			undefined,
			fields.length === 3 ? second : undefined,
		)
		if (!ref) continue
		const id = `${ref.market}:${ref.code}`
		if (seen.has(id)) continue
		seen.add(id)
		out.push({ market: ref.market, code: ref.code, type: ref.type })
		if (out.length >= WATCHLIST_LIMIT) break
	}
	return out
}
