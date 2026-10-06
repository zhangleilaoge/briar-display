import type { ConstituentItem, MarketId, StockQuote, StockSearchItem } from '@briar/shared'
import { isStockCode } from '@briar/shared'
import { fetchJson, fetchText } from './http'
import { num, parseTencentTime } from './sources'
import { takeEastmoneyTrendSlot } from './trendSources'

/**
 * 个股相关数据源（2026-10 实测）：
 * 成分股
 * - 腾讯 proxy.finance.qq.com/cgi/cgi-bin/rank/hs/getBoardRankList?board_code=pt01801081|pt02GN2448：
 *   A股行业 / 概念板块成分股，count ≤ 200 分页，sort_type 只支持 priceRatio / price / turnover；
 *   含现价、涨跌幅、成交额(万)、换手率、PE(TTM)、总市值(亿)，没有主力净流入
 * - 东财 push2 clist fs=b:BKxxxx（A股板块走东财兜底时）：含 f62 主力净流入；共用东财全局限流
 * - Naver m.stock.naver.com/api/stocks/{industry|theme}/{no}：韩国业种 / 主题成分股（实时，pageSize ≤ 100）
 * - 纳斯达克 api.nasdaq.com/api/screener/stocks?sector=GICS行业：美股行业成分股名单（limit=100 翻页），
 *   剔除权证/优先股等杂项后用腾讯 qt 批量补报价（中文名 / 成交额 / 换手率 / PE / 市值）
 * - 港股/美股概念板块：人工维护题材名单（catalog.ts CONCEPT_SECTORS），腾讯 qt 批量报价后聚合
 *   （涨跌幅等权平均、成交额求和、涨跌家数、领涨股）；恒生综合行业指数、日本行业 ETF 仍无免费成分股接口
 * 个股报价
 * - 腾讯 qt.gtimg.cn：A股（实时）、港股（延迟 15 分钟）、美股（延迟报价，按 15 分钟计）
 * - Naver polling domestic/stock（韩国实时）+ m.stock.naver.com/api/stock/{code}/integration（PER/PBR）
 * - Naver api.stock.naver.com/stock/{code}.T/basic（日本，延迟 15 分钟，含英文名 / PER / PBR）
 * 搜索
 * - 腾讯 smartbox.gtimg.cn/s3：A股 / 港股 / 美股，支持代码、中文名、拼音首字母（gzmt → 贵州茅台）
 * - Naver ac.stock.naver.com/ac：韩国 / 日本（代码、韩文、英文名）
 */

const TENCENT_HEADERS = { Referer: 'https://gu.qq.com/' }
const NAVER_HEADERS = { Referer: 'https://m.stock.naver.com/' }
const EM_HEADERS = { Referer: 'https://quote.eastmoney.com/' }

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

const scaled = (v: unknown, factor: number) => {
	const n = num(v)
	return n == null ? null : Math.round(n * factor)
}

/** "12.20배" / "46.41%" / "N/A" → 数字 */
export const looseNum = (v: unknown) =>
	typeof v === 'string' ? num(v.replace(/[^0-9.,+-]/g, '')) : num(v)

// ───────────────────────── 腾讯 A股板块成分股 ─────────────────────────

interface TencentBoardStocksResponse {
	code: number
	msg?: string
	data?: {
		total?: number
		rank_list?: Array<Record<string, string | undefined>>
	}
}

export function parseTencentBoardStocks(json: TencentBoardStocksResponse): {
	items: ConstituentItem[]
	total: number
} {
	if (json.code !== 0 || !json.data)
		throw new Error(`tencent board stocks: ${json.msg || json.code}`)
	const items = (json.data.rank_list || []).flatMap((r) => {
		if (!r.code || !/^(sh|sz|bj)\d{6}$/.test(r.code)) return []
		return [
			{
				code: r.code,
				name: r.name || r.code,
				price: num(r.zxj),
				changePct: num(r.zdf),
				// 成交额单位万元、总市值单位亿元
				amount: scaled(r.turnover, 1e4),
				turnoverRate: num(r.hsl),
				netInflow: null,
				marketCap: scaled(r.zsz, 1e8),
				pe: num(r.pe_ttm),
			} satisfies ConstituentItem,
		]
	})
	return { items, total: json.data.total ?? items.length }
}

const tencentBoardUrl = (board: string, direct: 'down' | 'up', offset: number, count: number) =>
	`https://proxy.finance.qq.com/cgi/cgi-bin/rank/hs/getBoardRankList?_appver=11.17.0&board_code=${encodeURIComponent(board)}&sort_type=priceRatio&direct=${direct}&offset=${offset}&count=${count}`

export interface RawConstituents {
	items: ConstituentItem[]
	total: number
	truncatedNote?: string
}

/**
 * 成分股 ≤ cap 只全取；超过时取「涨幅前 cap/2 + 跌幅前 cap/2」（两次请求），
 * 既能看到领涨也能看到领跌，请求量固定
 */
export async function fetchTencentBoardStocks(board: string, cap = 400): Promise<RawConstituents> {
	const page = 200
	const first = parseTencentBoardStocks(
		await fetchJson<TencentBoardStocksResponse>(tencentBoardUrl(board, 'down', 0, page), {
			headers: TENCENT_HEADERS,
		}),
	)
	const { total } = first
	const seen = new Map(first.items.map((i) => [i.code, i]))
	if (total > page) {
		const half = cap / 2
		const second =
			total <= cap
				? await fetchJson<TencentBoardStocksResponse>(tencentBoardUrl(board, 'down', page, page), {
						headers: TENCENT_HEADERS,
					})
				: await fetchJson<TencentBoardStocksResponse>(tencentBoardUrl(board, 'up', 0, half), {
						headers: TENCENT_HEADERS,
					})
		if (total > cap) for (const code of [...seen.keys()].slice(half)) seen.delete(code)
		for (const item of parseTencentBoardStocks(second).items) seen.set(item.code, item)
	}
	if (seen.size === 0) throw new Error(`tencent board stocks ${board}: empty`)
	return {
		items: [...seen.values()],
		total,
		...(total > cap
			? { truncatedNote: `成分股共 ${total} 只，只展示涨幅前 ${cap / 2} 和跌幅前 ${cap / 2} 只` }
			: {}),
	}
}

// ───────────────────────── 东财 A股板块成分股（兜底） ─────────────────────────

interface EmListResponse {
	data?: {
		total?: number
		diff?: Array<Record<string, unknown>> | Record<string, Record<string, unknown>>
	} | null
}

/** 东财 f13 市场 + f12 代码 → sh/sz/bj 前缀（北交所 f13=0，代码 4/8/92 开头） */
export function eastmoneyToCnCode(market: unknown, code: string): string | null {
	if (!/^\d{6}$/.test(code)) return null
	if (String(market) === '1') return `sh${code}`
	if (/^(4|8|92)/.test(code)) return `bj${code}`
	return `sz${code}`
}

export function parseEastmoneyBoardStocks(json: EmListResponse): {
	items: ConstituentItem[]
	total: number
} {
	const diff = json.data?.diff
	const rows = !diff ? [] : Array.isArray(diff) ? diff : Object.values(diff)
	const items = rows.flatMap((r) => {
		const code = eastmoneyToCnCode(r.f13, String(r.f12 ?? ''))
		if (!code) return []
		return [
			{
				code,
				name: String(r.f14 ?? code),
				price: num(r.f2),
				changePct: num(r.f3),
				amount: num(r.f6),
				turnoverRate: num(r.f8),
				netInflow: num(r.f62),
				marketCap: num(r.f20),
				pe: num(r.f9),
			} satisfies ConstituentItem,
		]
	})
	return { items, total: json.data?.total ?? items.length }
}

const EM_BUSY = '东财请求过于频繁，稍后再试'

export async function fetchEastmoneyBoardStocks(
	board: string,
	cap = 400,
): Promise<RawConstituents> {
	const fields = 'f2,f3,f6,f8,f9,f12,f13,f14,f20,f62'
	const seen = new Map<string, ConstituentItem>()
	let total = 0
	for (let pn = 1; pn <= cap / 100; pn++) {
		// 和东财走势共用一个全局限流（同 IP 连发会被封）
		if (!takeEastmoneyTrendSlot()) {
			if (seen.size) break
			throw new Error(EM_BUSY)
		}
		const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${pn}&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&fs=b:${encodeURIComponent(board)}+f:!50&fields=${fields}`
		const parsed = parseEastmoneyBoardStocks(
			await fetchJson<EmListResponse>(url, { headers: EM_HEADERS }),
		)
		total = parsed.total
		for (const item of parsed.items) seen.set(item.code, item)
		if (parsed.items.length === 0 || seen.size >= total) break
	}
	if (seen.size === 0) throw new Error(`eastmoney board stocks ${board}: empty`)
	return {
		items: [...seen.values()],
		total,
		...(total > seen.size
			? { truncatedNote: `成分股共 ${total} 只，只展示涨幅前 ${seen.size} 只` }
			: {}),
	}
}

// ───────────────────────── Naver 韩国业种 / 主题成分股 ─────────────────────────

interface NaverGroupStocksResponse {
	totalCount?: number
	stocks?: Array<Record<string, unknown>>
}

export function parseNaverGroupStocks(json: NaverGroupStocksResponse): {
	items: ConstituentItem[]
	total: number
} {
	const items = (json.stocks || []).flatMap((s) => {
		const code = String(s.itemCode ?? '')
		if (!/^[0-9A-Z]{6}$/.test(code)) return []
		return [
			{
				code,
				name: String(s.stockName ?? code),
				price: num(s.closePriceRaw ?? s.closePrice),
				changePct: num(s.fluctuationsRatio),
				amount: num(s.accumulatedTradingValueRaw),
				turnoverRate: null,
				netInflow: null,
				marketCap: num(s.marketValueRaw),
				pe: null,
			} satisfies ConstituentItem,
		]
	})
	return { items, total: json.totalCount ?? items.length }
}

export async function fetchNaverGroupStocks(
	type: 'industry' | 'theme',
	no: string,
	cap = 400,
): Promise<RawConstituents> {
	const pageSize = 100
	const seen = new Map<string, ConstituentItem>()
	let total = 0
	for (let page = 1; page <= cap / pageSize; page++) {
		const url = `https://m.stock.naver.com/api/stocks/${type}/${encodeURIComponent(no)}?page=${page}&pageSize=${pageSize}`
		let json: NaverGroupStocksResponse
		try {
			json = await fetchJson<NaverGroupStocksResponse>(url, { headers: NAVER_HEADERS, retries: 1 })
		} catch (err) {
			if (page > 1 && seen.size > 0) break
			throw err
		}
		const parsed = parseNaverGroupStocks(json)
		total = parsed.total
		for (const item of parsed.items) seen.set(item.code, item)
		if (parsed.items.length < pageSize || seen.size >= total) break
	}
	if (seen.size === 0) throw new Error(`naver ${type} ${no} stocks: empty`)
	return {
		items: [...seen.values()],
		total,
		...(total > seen.size
			? { truncatedNote: `成分股共 ${total} 只，只展示前 ${seen.size} 只` }
			: {}),
	}
}

// ───────────────────────── 纳斯达克 美股行业成分股 ─────────────────────────

const NASDAQ_HEADERS = {
	Referer: 'https://www.nasdaq.com/',
	Accept: 'application/json, text/plain, */*',
}

interface NasdaqScreenerResponse {
	data?: {
		totalrecords?: number
		table?: { rows?: Array<Record<string, string>> } | null
	} | null
}

/** 剔除权证 / 优先股 / 债券型等杂项（保留普通股、ADR、单位信托等） */
const NASDAQ_JUNK_NAME = /(warrant|preferred|rights?\b|notes?\b|debenture|subordinated|units?$)/i

/** "Apple Inc. Common Stock" → "Apple Inc."；ADR 等带括号说明的保留主体 */
export function cleanNasdaqName(raw: string): string {
	return raw
		.replace(/\s*\(?Common Stock\)?$/i, '')
		.replace(/\s+Common Units.*$/i, '')
		.trim()
}

export function parseNasdaqScreener(json: NasdaqScreenerResponse): {
	items: ConstituentItem[]
	total: number
} {
	const rows = json.data?.table?.rows
	if (!rows) throw new Error('nasdaq screener: no rows')
	const items = rows.flatMap((r) => {
		const symbol = (r.symbol ?? '').toUpperCase()
		if (!isStockCode('us', symbol)) return []
		if (NASDAQ_JUNK_NAME.test(r.name ?? '')) return []
		return [
			{
				code: symbol,
				name: cleanNasdaqName(r.name ?? symbol),
				price: looseNum(r.lastsale),
				changePct: looseNum(r.pctchange),
				amount: null,
				turnoverRate: null,
				netInflow: null,
				marketCap: looseNum(r.marketCap),
				pe: null,
			} satisfies ConstituentItem,
		]
	})
	return { items, total: json.data?.totalrecords ?? items.length }
}

/**
 * 美股行业成分股：纳斯达克筛选器按 GICS 行业拉名单（limit=100 翻页，cap 封顶），
 * 再用腾讯 qt 批量补实时字段（中文名 / 现价 / 涨跌幅 / 成交额 / 换手率 / PE / 总市值），
 * 腾讯缺失的用纳斯达克数据兜底
 */
export async function fetchUsSectorConstituents(gics: string, cap = 400): Promise<RawConstituents> {
	const pageSize = 100
	const seen = new Map<string, ConstituentItem>()
	let total = 0
	for (let offset = 0; offset < cap; offset += pageSize) {
		const url = `https://api.nasdaq.com/api/screener/stocks?tableOnly=true&sector=${encodeURIComponent(gics)}&limit=${pageSize}&offset=${offset}`
		const parsed = parseNasdaqScreener(
			await fetchJson<NasdaqScreenerResponse>(url, { headers: NASDAQ_HEADERS, retries: 1 }),
		)
		total = parsed.total
		for (const item of parsed.items) seen.set(item.code, item)
		if (parsed.items.length < pageSize || seen.size >= Math.min(total, cap)) break
	}
	if (seen.size === 0) throw new Error(`nasdaq screener ${gics}: empty`)
	// 腾讯 qt 批量报价，100 个一批
	const refs = [...seen.keys()].map((code) => ({ market: 'us' as const, code }))
	const quotes = new Map<string, StockQuote>()
	for (let i = 0; i < refs.length; i += 100) {
		try {
			for (const q of await fetchTencentStockQuotes(refs.slice(i, i + 100))) {
				quotes.set(q.code, q)
			}
		} catch {
			// 腾讯批次失败不致命，纳斯达克数据兜底
		}
	}
	const items = [...seen.values()].map((item) => {
		const q = quotes.get(item.code)
		if (!q) return item
		return {
			...item,
			name: q.name || item.name,
			price: q.price ?? item.price,
			changePct: q.changePct ?? item.changePct,
			amount: q.amount ?? item.amount,
			turnoverRate: q.turnoverRate ?? item.turnoverRate,
			marketCap: q.marketCap ?? item.marketCap,
			pe: q.pe ?? item.pe,
		}
	})
	return {
		items,
		total,
		...(total > items.length
			? { truncatedNote: `成分股共 ${total} 只，只展示前 ${items.length} 只` }
			: {}),
	}
}

// ───────────────────────── 腾讯个股报价（A股 / 港股 / 美股） ─────────────────────────

/** 个股代码 → 腾讯 qt 代码：sh600519 / hk00700 / usAAPL */
export function tencentStockCode(market: MarketId, code: string): string {
	if (market === 'hk') return `hk${code}`
	if (market === 'us') return `us${code}`
	return code
}

/**
 * 腾讯 qt 个股字段（~ 分隔）：3 现价 4 昨收 5 开 6 量 30 时间 31 涨跌 32 涨跌幅 33 高 34 低 37 成交额 38 换手率 39 PE 45 总市值（亿）
 * - A股：量单位手、成交额单位万元、46 为 PB
 * - 港股：量为股、成交额为港元、换手率在 59（38 恒为 0）
 * - 美股：量为股、成交额为美元
 */
export function parseTencentStockQt(text: string): StockQuote[] {
	const out: StockQuote[] = []
	for (const line of text.split(';')) {
		const match = line.trim().match(/^v_(sh|sz|bj|hk|us)([^=]+)="([^"]*)"$/)
		if (!match) continue
		const [, prefix, rest, body] = match
		const f = body.split('~')
		if (f.length < 46 || !f[1]) continue
		const market: MarketId = prefix === 'hk' ? 'hk' : prefix === 'us' ? 'us' : 'cn'
		const code = market === 'cn' ? `${prefix}${rest}` : market === 'us' ? rest.toUpperCase() : rest
		const cn = market === 'cn'
		out.push({
			market,
			code,
			name: f[1],
			price: num(f[3]),
			change: num(f[31]),
			changePct: num(f[32]),
			prevClose: num(f[4]),
			open: num(f[5]),
			high: num(f[33]),
			low: num(f[34]),
			amount: cn ? scaled(f[37], 1e4) : num(f[37]),
			volume: cn ? scaled(f[6], 100) : num(f[6]),
			turnoverRate: market === 'hk' ? num(f[59]) : num(f[38]),
			marketCap: scaled(f[45], 1e8),
			pe: num(f[39]),
			pb: cn ? num(f[46]) : null,
			currency: market === 'hk' ? 'HKD' : market === 'us' ? 'USD' : 'CNY',
			quoteTime: parseTencentTime(prefix, f[30] || ''),
			delayMinutes: market === 'cn' ? 0 : 15,
			source: '腾讯行情 qt',
		})
	}
	return out
}

export async function fetchTencentStockQuotes(
	refs: { market: MarketId; code: string }[],
): Promise<StockQuote[]> {
	if (refs.length === 0) return []
	const codes = refs.map((r) => tencentStockCode(r.market, r.code))
	const text = await fetchText(`https://qt.gtimg.cn/q=${codes.map(encodeURIComponent).join(',')}`, {
		encoding: 'gbk',
		headers: TENCENT_HEADERS,
	})
	return parseTencentStockQt(text)
}

// ───────────────────────── Naver 个股报价（韩国 / 日本） ─────────────────────────

interface NaverPollingResponse {
	datas?: Array<Record<string, unknown>>
}

const naverTime = (v: unknown) => {
	const t = typeof v === 'string' ? Date.parse(v) : Number.NaN
	return Number.isFinite(t) ? t : null
}

/** polling.finance.naver.com realtime domestic/stock 或 worldstock/stock */
export function parseNaverStockPolling(
	json: NaverPollingResponse,
	market: 'kr' | 'jp',
): StockQuote[] {
	return (json.datas || []).flatMap((d) => {
		const raw = String(d.itemCode ?? d.symbolCode ?? d.reutersCode ?? '')
		const code = market === 'jp' ? raw.replace(/\.T$/, '') : raw
		if (!code) return []
		const price = num(d.closePriceRaw ?? d.closePrice)
		const change = num(d.compareToPreviousClosePriceRaw ?? d.compareToPreviousClosePrice)
		const exchange = d.stockExchangeType as { delayTime?: number } | undefined
		return [
			{
				market,
				code,
				name: String(d.stockName ?? code),
				price,
				change,
				changePct: num(d.fluctuationsRatioRaw ?? d.fluctuationsRatio),
				prevClose: price != null && change != null ? Number((price - change).toFixed(4)) : null,
				open: num(d.openPriceRaw),
				high: num(d.highPriceRaw),
				low: num(d.lowPriceRaw),
				amount: num(d.accumulatedTradingValueRaw),
				volume: num(d.accumulatedTradingVolumeRaw),
				turnoverRate: null,
				marketCap: num(d.marketValueFullRaw),
				pe: null,
				pb: null,
				currency: market === 'kr' ? 'KRW' : 'JPY',
				quoteTime: naverTime(d.localTradedAt),
				delayMinutes: exchange?.delayTime ?? (market === 'jp' ? 15 : 0),
				source: 'Naver 证券',
			} satisfies StockQuote,
		]
	})
}

export async function fetchNaverStockQuotes(
	market: 'kr' | 'jp',
	codes: string[],
): Promise<StockQuote[]> {
	if (codes.length === 0) return []
	const path = market === 'kr' ? 'domestic/stock' : 'worldstock/stock'
	const ids = market === 'jp' ? codes.map((c) => `${c}.T`) : codes
	const json = await fetchJson<NaverPollingResponse>(
		`https://polling.finance.naver.com/api/realtime/${path}/${ids.map(encodeURIComponent).join(',')}`,
		{ headers: NAVER_HEADERS, retries: 1 },
	)
	return parseNaverStockPolling(json, market)
}

interface NaverInfoRow {
	code?: string
	value?: string
}

/** Naver totalInfos / stockItemTotalInfos 里取 PER / PBR */
export function parseNaverValuation(rows: NaverInfoRow[] | undefined): {
	pe: number | null
	pb: number | null
} {
	const find = (code: string) => looseNum(rows?.find((r) => r.code === code)?.value)
	return { pe: find('per'), pb: find('pbr') }
}

/** 韩国个股 PER / PBR（integration 接口，非实时字段，调用方长缓存） */
export async function fetchNaverKrValuation(code: string) {
	const json = await fetchJson<{ totalInfos?: NaverInfoRow[] }>(
		`https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/integration`,
		{ headers: NAVER_HEADERS, retries: 1 },
	)
	return parseNaverValuation(json.totalInfos)
}

/** 日本个股 basic：报价 + 英文名 + PER / PBR 一次拿全 */
export function parseNaverJpBasic(json: Record<string, unknown>, code: string): StockQuote {
	const [quote] = parseNaverStockPolling({ datas: [{ ...json, itemCode: code }] }, 'jp')
	const valuation = parseNaverValuation(json.stockItemTotalInfos as NaverInfoRow[] | undefined)
	const nameEng = typeof json.stockNameEng === 'string' ? json.stockNameEng : ''
	return {
		...quote,
		name: nameEng || quote.name,
		delayMinutes: num(json.delayTime) ?? 15,
		...valuation,
	}
}

export async function fetchNaverJpQuote(code: string): Promise<StockQuote> {
	const json = await fetchJson<Record<string, unknown>>(
		`https://api.stock.naver.com/stock/${encodeURIComponent(code)}.T/basic`,
		{ headers: NAVER_HEADERS, retries: 1 },
	)
	if (!json || json.closePriceRaw == null) throw new Error(`naver jp ${code}: empty`)
	return parseNaverJpBasic(json, code)
}

// ───────────────────────── 搜索 ─────────────────────────

const CN_EXCHANGE: Record<string, string> = {
	'GP-A-KCB': '科创板',
	'GP-A-CYB': '创业板',
}

const US_EXCHANGE: Record<string, string> = {
	oq: 'NASDAQ',
	o: 'NASDAQ',
	n: 'NYSE',
	am: 'NYSE Arca',
	ps: 'OTC',
}

/** 腾讯 smartbox：v_hint="sh~600519~\u8d35…~gzmt~GP-A^hk~00700~…~GP^us~aapl.oq~苹果~pg~GP" */
export function parseTencentSmartbox(text: string): StockSearchItem[] {
	const m = text.match(/v_hint="([^"]*)"/)
	if (!m || !m[1] || m[1] === 'N') return []
	const decoded = m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
		String.fromCharCode(Number.parseInt(hex, 16)),
	)
	const out: StockSearchItem[] = []
	for (const entry of decoded.split('^')) {
		const [prefix, rawCode, name, , type = ''] = entry.split('~')
		if (!prefix || !rawCode || !name) continue
		if ((prefix === 'sh' || prefix === 'sz' || prefix === 'bj') && /^(GP-A|ETF)/.test(type)) {
			if (!/^\d{6}$/.test(rawCode)) continue
			out.push({
				market: 'cn',
				code: `${prefix}${rawCode}`,
				name,
				type: type === 'ETF' ? 'etf' : 'stock',
				exchange:
					prefix === 'bj' ? '北交所' : CN_EXCHANGE[type] || (prefix === 'sh' ? '上交所' : '深交所'),
			})
		} else if (prefix === 'hk' && type.startsWith('GP') && /^\d{5}$/.test(rawCode)) {
			out.push({
				market: 'hk',
				code: rawCode,
				name,
				type: /etf/i.test(name) ? 'etf' : 'stock',
				exchange: '港交所',
			})
		} else if (prefix === 'us' && type.startsWith('GP')) {
			const dot = rawCode.lastIndexOf('.')
			const symbol = (dot > 0 ? rawCode.slice(0, dot) : rawCode).toUpperCase()
			const suffix = dot > 0 ? rawCode.slice(dot + 1).toLowerCase() : ''
			if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) continue
			out.push({
				market: 'us',
				code: symbol,
				name,
				type: /etf/i.test(name) ? 'etf' : 'stock',
				...(US_EXCHANGE[suffix] ? { exchange: US_EXCHANGE[suffix] } : {}),
			})
		}
	}
	return out
}

export async function fetchTencentSmartbox(q: string): Promise<StockSearchItem[]> {
	const text = await fetchText(
		`https://smartbox.gtimg.cn/s3/?v=2&q=${encodeURIComponent(q)}&t=all&c=1`,
		{ headers: TENCENT_HEADERS, timeoutMs: 5_000 },
	).catch((err) => {
		// 无结果时 smartbox 回空串（http 层按失败处理），这里当作空结果
		if (/empty body/.test(errorMessage(err))) return ''
		throw err
	})
	return parseTencentSmartbox(text)
}

interface NaverAcResponse {
	items?: Array<{
		code?: string
		name?: string
		typeCode?: string
		reutersCode?: string
		nationCode?: string
		category?: string
		url?: string
	}>
}

/** Naver 自动完成：只取韩国 / 日本个股与 ETF（美股走腾讯，有中文名） */
export function parseNaverAc(json: NaverAcResponse): StockSearchItem[] {
	const out: StockSearchItem[] = []
	for (const i of json.items || []) {
		if (i.category !== 'stock' || !i.code || !i.name) continue
		const type = /\/etf\//.test(i.url || '') ? 'etf' : 'stock'
		if (i.nationCode === 'KOR' && /^[0-9A-Z]{6}$/.test(i.code)) {
			out.push({ market: 'kr', code: i.code, name: i.name, type, exchange: i.typeCode })
		} else if (i.nationCode === 'JPN' && /\.T$/.test(i.reutersCode || '')) {
			const code = (i.reutersCode as string).replace(/\.T$/, '')
			if (/^[0-9][0-9A-Z]{3}$/.test(code))
				out.push({ market: 'jp', code, name: i.name, type, exchange: '东证' })
		}
	}
	return out
}

export async function fetchNaverAc(q: string): Promise<StockSearchItem[]> {
	const json = await fetchJson<NaverAcResponse>(
		`https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock`,
		{ headers: NAVER_HEADERS, timeoutMs: 5_000 },
	)
	return parseNaverAc(json)
}
