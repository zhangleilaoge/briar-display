import {
	type ConstituentItem,
	type ConstituentSortKey,
	type MarketId,
	type SectorConstituentsResponse,
	type SectorKind,
	type StockQuote,
	type StockQuoteResponse,
	type StockQuotesResponse,
	type StockRef,
	type StockSearchItem,
	type StockSearchResponse,
	WATCHLIST_LIMIT,
	isStockCode,
} from '@briar/shared'
import { cachedLoad } from './cache'
import { HK_INDUSTRY_INDICES, JP_TOPIX17_ETFS, US_SECTOR_ETFS, US_THEME_ETFS } from './catalog'
import { MarketInputError, SECTOR_CONFIG } from './marketService'
import { CACHE_TTL_MS, POLL_MS, getSessionInfo, getSessionStatus } from './session'
import {
	type RawConstituents,
	fetchEastmoneyBoardStocks,
	fetchNaverAc,
	fetchNaverGroupStocks,
	fetchNaverJpQuote,
	fetchNaverKrValuation,
	fetchNaverStockQuotes,
	fetchTencentBoardStocks,
	fetchTencentSmartbox,
	fetchTencentStockQuotes,
} from './stockSources'

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

const ttlOf = (market: MarketId) => CACHE_TTL_MS[getSessionStatus(market, Date.now())]

/** 东财兜底源缓存至少 30s（同 IP 连发会被封） */
const EASTMONEY_MIN_TTL_MS = 30_000
/** 估值（PER/PBR）不是实时字段，缓存 10 分钟 */
const VALUATION_TTL_MS = 10 * 60_000
/** 搜索结果基本不变，缓存 10 分钟 */
export const SEARCH_TTL_MS = 10 * 60_000
/** 成分股上限：超过的板块取涨幅前 200 + 跌幅前 200 */
export const CONSTITUENT_CAP = 400

export function assertStockCode(market: MarketId, code: string) {
	if (!isStockCode(market, code)) throw new MarketInputError('股票代码格式不正确')
}

// ───────────────────────── 板块成分股 ─────────────────────────

const CN_TENCENT_BOARD = /^pt0[12][0-9A-Z]{3,12}$/
const CN_EM_BOARD = /^BK\d{4}$/
const KR_GROUP = /^[0-9]{1,8}$/

const NO_HK_CONSTITUENTS =
	'恒生综合行业指数的成分股没有免费公开的数据源（恒指公司只向授权机构提供），暂不支持查看成分股'
const NO_ETF_CONSTITUENTS =
	'该板块以行业 / 主题 ETF 代理，ETF 持仓没有免费的实时数据源，暂不支持查看成分股'

interface ConstituentPlan {
	load?: () => Promise<RawConstituents>
	reason?: string
	source: string
	delayMinutes: number
	netInflowBasis: string | null
	peBasis: string | null
	eastmoney?: boolean
}

function planConstituents(market: MarketId, code: string, kind: SectorKind): ConstituentPlan {
	const none = (reason: string): ConstituentPlan => ({
		reason,
		source: '',
		delayMinutes: 0,
		netInflowBasis: null,
		peBasis: null,
	})
	switch (market) {
		case 'cn':
			if (CN_TENCENT_BOARD.test(code)) {
				return {
					load: () => fetchTencentBoardStocks(code, CONSTITUENT_CAP),
					source: '腾讯自选股 板块成分股',
					delayMinutes: 0,
					netInflowBasis: null,
					peBasis: '市盈率（TTM）',
				}
			}
			if (CN_EM_BOARD.test(code)) {
				return {
					load: () => fetchEastmoneyBoardStocks(code, CONSTITUENT_CAP),
					source: '东方财富 板块成分股',
					delayMinutes: 0,
					netInflowBasis: '主力净流入（超大单+大单净额）',
					peBasis: '市盈率（动态）',
					eastmoney: true,
				}
			}
			break
		case 'kr':
			if (KR_GROUP.test(code)) {
				const type = kind === 'concept' ? 'theme' : 'industry'
				return {
					load: () => fetchNaverGroupStocks(type, code, CONSTITUENT_CAP),
					source: kind === 'concept' ? 'Naver 证券 主题成分股' : 'Naver 证券 业种成分股',
					delayMinutes: 0,
					netInflowBasis: null,
					peBasis: null,
				}
			}
			break
		case 'hk':
			if (HK_INDUSTRY_INDICES.some((d) => d.code === code)) return none(NO_HK_CONSTITUENTS)
			break
		case 'us':
			if ([...US_SECTOR_ETFS, ...US_THEME_ETFS].some((d) => d.code === code)) {
				return none(NO_ETF_CONSTITUENTS)
			}
			break
		case 'jp':
			if (JP_TOPIX17_ETFS.some((d) => d.code === code)) return none(NO_ETF_CONSTITUENTS)
			break
	}
	throw new MarketInputError('未知的板块代码')
}

const CONSTITUENT_SORT_KEYS: ConstituentSortKey[] = [
	'changePct',
	'price',
	'amount',
	'turnoverRate',
	'netInflow',
	'marketCap',
	'pe',
]

export function constituentSortKeys(items: ConstituentItem[]): ConstituentSortKey[] {
	return CONSTITUENT_SORT_KEYS.filter((k) => items.some((i) => i[k] != null))
}

export async function getConstituents(
	market: MarketId,
	code: string,
	kind: SectorKind,
): Promise<SectorConstituentsResponse> {
	const plan = planConstituents(market, code, kind)
	const now = Date.now()
	const base = {
		market,
		code,
		kind,
		amountCurrency: SECTOR_CONFIG[market].currency || (market === 'kr' ? 'KRW' : ''),
		source: plan.source,
		delayMinutes: plan.delayMinutes,
		peBasis: plan.peBasis,
	}
	if (!plan.load) {
		return {
			...base,
			available: false,
			reason: plan.reason,
			items: [],
			total: 0,
			sortKeys: [],
			netInflowBasis: null,
			session: getSessionInfo(market, now),
			fetchedAt: now,
			stale: false,
		}
	}
	let ttl = ttlOf(market)
	if (plan.eastmoney) ttl = Math.max(ttl, EASTMONEY_MIN_TTL_MS)
	const load = plan.load
	// KR 业种 / 主题编号会重复，kind 进 key
	const result = await cachedLoad(`constituents:${market}:${kind}:${code}`, ttl, load)
	const { items, total, truncatedNote } = result.value
	const sorted = [...items].sort(
		(a, b) => (b.changePct ?? Number.NEGATIVE_INFINITY) - (a.changePct ?? Number.NEGATIVE_INFINITY),
	)
	return {
		...base,
		available: true,
		items: sorted,
		total,
		...(truncatedNote ? { truncatedNote } : {}),
		sortKeys: constituentSortKeys(sorted),
		netInflowBasis:
			plan.netInflowBasis && items.some((i) => i.netInflow != null) ? plan.netInflowBasis : null,
		session: getSessionInfo(market, now),
		fetchedAt: result.fetchedAt,
		stale: result.stale,
		...(result.error ? { error: result.error.slice(0, 300) } : {}),
	}
}

// ───────────────────────── 个股报价 ─────────────────────────

async function loadKrValuation(code: string) {
	try {
		return (
			await cachedLoad(`stock:valuation:kr:${code}`, VALUATION_TTL_MS, () =>
				fetchNaverKrValuation(code),
			)
		).value
	} catch (err) {
		console.warn(`[markets] 韩国个股估值 ${code} 失败:`, errorMessage(err))
		return { pe: null, pb: null }
	}
}

async function loadStockQuote(market: MarketId, code: string): Promise<StockQuote> {
	let quote: StockQuote | undefined
	if (market === 'jp') {
		quote = await fetchNaverJpQuote(code)
	} else if (market === 'kr') {
		const [rows, valuation] = await Promise.all([
			fetchNaverStockQuotes('kr', [code]),
			loadKrValuation(code),
		])
		quote = rows.find((r) => r.code === code)
		if (quote) quote = { ...quote, ...valuation }
	} else {
		const rows = await fetchTencentStockQuotes([{ market, code }])
		quote = rows.find((r) => r.market === market && r.code === code)
	}
	if (!quote || (quote.price == null && quote.prevClose == null)) {
		throw new MarketInputError('未找到该股票的行情')
	}
	return quote
}

/** 个股报价：交易中 20s（可配 15–30s），休市更长；与走势、自选共用全局缓存 */
export async function getStockQuote(market: MarketId, code: string): Promise<StockQuoteResponse> {
	assertStockCode(market, code)
	const result = await cachedLoad(`stock:quote:${market}:${code}`, ttlOf(market), () =>
		loadStockQuote(market, code),
	)
	return {
		quote: result.value,
		session: getSessionInfo(market, Date.now(), result.value.quoteTime),
		fetchedAt: result.fetchedAt,
		stale: result.stale,
		...(result.error ? { error: result.error.slice(0, 300) } : {}),
	}
}

/** 自选列表批量报价：A股/港股/美股一次腾讯 qt，韩国 / 日本各一次 Naver polling */
export async function getStockQuotes(
	refs: Pick<StockRef, 'market' | 'code'>[],
): Promise<StockQuotesResponse> {
	const unique = [
		...new Map(
			refs.filter((r) => isStockCode(r.market, r.code)).map((r) => [`${r.market}:${r.code}`, r]),
		).values(),
	].slice(0, WATCHLIST_LIMIT)
	const groups: { key: string; markets: MarketId[]; load: () => Promise<StockQuote[]> }[] = []
	const tencent = unique.filter((r) => r.market === 'cn' || r.market === 'hk' || r.market === 'us')
	if (tencent.length)
		groups.push({
			key: 'tencent',
			markets: ['cn', 'hk', 'us'],
			load: () => fetchTencentStockQuotes(tencent),
		})
	for (const m of ['kr', 'jp'] as const) {
		const codes = unique.filter((r) => r.market === m).map((r) => r.code)
		if (codes.length)
			groups.push({ key: m, markets: [m], load: () => fetchNaverStockQuotes(m, codes) })
	}
	const groupRefs = (key: string) =>
		key === 'tencent' ? tencent : unique.filter((r) => r.market === key)
	const settled = await Promise.allSettled(
		groups.map((g) => {
			const ids = groupRefs(g.key)
				.map((r) => `${r.market}:${r.code}`)
				.sort()
				.join(',')
			const ttl = Math.min(...g.markets.map(ttlOf))
			return cachedLoad(`stock:quotes:${g.key}:${ids}`, ttl, g.load)
		}),
	)
	const byId = new Map<string, StockQuote>()
	let fetchedAt = 0
	let stale = false
	const errors: string[] = []
	for (const s of settled) {
		if (s.status === 'rejected') {
			errors.push(errorMessage(s.reason))
			continue
		}
		fetchedAt = Math.max(fetchedAt, s.value.fetchedAt)
		if (s.value.stale) stale = true
		if (s.value.error) errors.push(s.value.error)
		for (const q of s.value.value) byId.set(`${q.market}:${q.code}`, q)
	}
	if (groups.length && settled.every((s) => s.status === 'rejected')) {
		throw new Error(errors.join('; ') || '行情源暂时不可用')
	}
	const markets = [...new Set(unique.map((r) => r.market))]
	const now = Date.now()
	return {
		items: unique.flatMap((r) => byId.get(`${r.market}:${r.code}`) ?? []),
		pollMs: markets.length
			? Math.min(...markets.map((m) => POLL_MS[getSessionStatus(m, now)]))
			: POLL_MS.closed,
		fetchedAt: fetchedAt || now,
		stale,
		...(errors.length ? { error: errors.join('; ').slice(0, 300) } : {}),
	}
}

// ───────────────────────── 搜索 ─────────────────────────

export const SEARCH_LIMIT = 30

/** 搜索词规范化：去首尾空白、合并空格、截断 24 字符 */
export function normalizeQuery(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ').slice(0, 24)
}

/** 代码完全匹配的排最前（600519 / sh600519 / aapl / 00700 / 005930 / 7203），其余保持数据源顺序；按市场+代码去重 */
export function rankSearchResults(
	q: string,
	lists: StockSearchItem[][],
	limit = SEARCH_LIMIT,
): StockSearchItem[] {
	const needle = q.toLowerCase()
	const seen = new Set<string>()
	const merged: StockSearchItem[] = []
	for (const item of lists.flat()) {
		const id = `${item.market}:${item.code}`
		if (seen.has(id)) continue
		seen.add(id)
		merged.push(item)
	}
	const exact = (i: StockSearchItem) => {
		const code = i.code.toLowerCase()
		return code === needle || code.replace(/^(sh|sz|bj)/, '') === needle
	}
	return [...merged.filter(exact), ...merged.filter((i) => !exact(i))].slice(0, limit)
}

/** 跨市场搜索：腾讯 smartbox（A股/港股/美股，支持拼音首字母）+ Naver（韩国/日本） */
export async function searchStocks(raw: string): Promise<StockSearchResponse> {
	const q = normalizeQuery(raw)
	if (!q) throw new MarketInputError('请输入搜索关键词')
	// 纯中文 Naver 搜不到，省一次请求
	const naverUseful = /[A-Za-z0-9\uac00-\ud7af\u3040-\u30ff]/.test(q)
	const result = await cachedLoad(`search:${q.toLowerCase()}`, SEARCH_TTL_MS, async () => {
		const tasks: [string, Promise<StockSearchItem[]>][] = [
			['腾讯 smartbox', fetchTencentSmartbox(q)],
		]
		if (naverUseful) tasks.push(['Naver 自动完成', fetchNaverAc(q)])
		const settled = await Promise.allSettled(tasks.map(([, p]) => p))
		if (settled.every((s) => s.status === 'rejected')) {
			throw new Error(
				settled.map((s) => (s.status === 'rejected' ? errorMessage(s.reason) : '')).join('; '),
			)
		}
		const lists = settled.map((s) => (s.status === 'fulfilled' ? s.value : []))
		return {
			items: rankSearchResults(q, lists),
			sources: tasks.filter((_, i) => settled[i].status === 'fulfilled').map(([name]) => name),
		}
	})
	return { query: q, ...result.value }
}
