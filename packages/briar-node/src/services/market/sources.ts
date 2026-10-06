import type { MarketIndexQuote, SectorItem } from '@briar/shared'
import { fetchJson, fetchText } from './http'
import { zonedTimeToTs } from './session'

/**
 * 各行情源的请求 + 解析（解析函数纯函数导出，便于单测）。
 * 实测记录（2026-10）：
 * - 腾讯 proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getRank：A股板块（hy=申万一级 31 / hy2=申万二级 124 / gn=概念 ~800），
 *   count ≤ 200 分页，UTF-8 JSON，无需 Referer；含涨跌幅/成交额(万)/换手率/主力净流入(万)/领涨股
 * - 东财 push2 clist（m:90+t:2 行业 / t:3 概念）：pz ≤ 100 分页；同 IP 短时间请求多了会直接 Empty reply 封一段时间，
 *   所以只做 A股板块兜底；ulist.np（指定 secid 批量）不受影响，用于指数和恒生行业指数
 * - 腾讯 qt.gtimg.cn：GBK 文本，~ 分隔；美股 ETF 实时，港股指数约 15 分钟延迟
 * - Naver m.stock.naver.com / polling.finance.naver.com：韩国业种/主题（实时），日本 ETF / TOPIX（15 分钟延迟）
 */

const EM_HEADERS = { Referer: 'https://quote.eastmoney.com/' }
const TENCENT_HEADERS = { Referer: 'https://gu.qq.com/' }
const NAVER_HEADERS = { Referer: 'https://m.stock.naver.com/' }

/**
 * 东财 push2 主域名被封（Empty reply，通常封 IP 一段时间）时按同路径换备用域名重试。
 * push2delay 是东财延迟行情边缘节点，API 路径与 push2 一致；都失败才抛最后一个错。
 */
const EM_PUSH2_HOSTS = ['push2.eastmoney.com', 'push2delay.eastmoney.com']

export async function fetchEastmoneyPush2<T>(path: string): Promise<T> {
	let lastErr: unknown = null
	for (const host of EM_PUSH2_HOSTS) {
		try {
			return await fetchJson<T>(`https://${host}${path}`, { headers: EM_HEADERS })
		} catch (err) {
			lastErr = err
		}
	}
	throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/** 数字解析：兼容 "1,234.5" / "-" / 空串 / undefined */
export function num(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null
	if (typeof value !== 'string') return null
	const cleaned = value.replace(/,/g, '').trim()
	if (!cleaned || cleaned === '-') return null
	const n = Number(cleaned)
	return Number.isFinite(n) ? n : null
}

const emptySector = (code: string, name: string): SectorItem => ({
	code,
	name,
	price: null,
	changePct: null,
	amount: null,
	netInflow: null,
	turnoverRate: null,
	upCount: null,
	downCount: null,
	total: null,
	leader: null,
})

// ───────────────────────── 腾讯 A股板块 ─────────────────────────

interface TencentRankResponse {
	code: number
	msg?: string
	data?: {
		total?: number
		rank_list?: Array<{
			code: string
			name: string
			zxj?: string
			zdf?: string
			turnover?: string
			hsl?: string
			zljlr?: string
			zgb?: string
			lzg?: { code?: string; name?: string; zdf?: string }
		}>
	}
}

export function parseTencentBoards(json: TencentRankResponse): {
	items: SectorItem[]
	total: number
} {
	if (json.code !== 0 || !json.data) throw new Error(`tencent rank: ${json.msg || json.code}`)
	const items = (json.data.rank_list || []).map((row) => {
		// zgb = "上涨家数/成分股总数"
		const [up, total] = (row.zgb || '').split('/').map((v) => num(v))
		const turnover = num(row.turnover)
		const inflow = num(row.zljlr)
		return {
			...emptySector(row.code, row.name),
			price: num(row.zxj),
			changePct: num(row.zdf),
			// 腾讯成交额 / 主力净流入单位是万元
			amount: turnover == null ? null : turnover * 1e4,
			netInflow: inflow == null ? null : inflow * 1e4,
			turnoverRate: num(row.hsl),
			upCount: up ?? null,
			total: total ?? null,
			leader: row.lzg?.name
				? { name: row.lzg.name, code: row.lzg.code, changePct: num(row.lzg.zdf) }
				: null,
		}
	})
	return { items, total: json.data.total ?? items.length }
}

export async function fetchTencentBoards(boardType: 'hy' | 'hy2' | 'gn'): Promise<SectorItem[]> {
	const pageSize = 200
	const seen = new Map<string, SectorItem>()
	for (let page = 0; page < 8; page++) {
		const url = `https://proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getRank?board_type=${boardType}&sort_type=priceRatio&direct=down&offset=${page * pageSize}&count=${pageSize}`
		const { items, total } = parseTencentBoards(
			await fetchJson<TencentRankResponse>(url, { headers: TENCENT_HEADERS }),
		)
		for (const item of items) seen.set(item.code, item)
		if (items.length === 0 || seen.size >= total) break
	}
	if (seen.size === 0) throw new Error('tencent rank: empty list')
	return [...seen.values()]
}

// ───────────────────────── 东财 A股板块（兜底） ─────────────────────────

interface EmListResponse {
	rc?: number
	data?: {
		total?: number
		diff?: Array<Record<string, unknown>> | Record<string, Record<string, unknown>>
	} | null
}

/** 东财行业分级掩码 f111：2=一级 4=二级 8=三级 */
const EM_LEVEL_MASK: Record<string, number> = { '1': 2, '2': 4, '3': 8 }

const emRows = (json: EmListResponse) => {
	const diff = json.data?.diff
	if (!diff) return []
	return Array.isArray(diff) ? diff : Object.values(diff)
}

export function parseEastmoneyBoards(json: EmListResponse, level?: string): SectorItem[] {
	const mask = level ? EM_LEVEL_MASK[level] : undefined
	return emRows(json)
		.filter((r) => mask == null || num(r.f111) === mask)
		.map((r) => {
			const up = num(r.f104)
			const down = num(r.f105)
			return {
				...emptySector(String(r.f12), String(r.f14)),
				price: num(r.f2),
				changePct: num(r.f3),
				amount: num(r.f6),
				netInflow: num(r.f62),
				turnoverRate: num(r.f8),
				upCount: up,
				downCount: down,
				total: null,
				leader:
					typeof r.f128 === 'string' && r.f128 !== '-'
						? { name: r.f128, code: String(r.f140 ?? ''), changePct: num(r.f136) }
						: null,
			}
		})
}

export async function fetchEastmoneyBoards(t: 2 | 3, level?: string): Promise<SectorItem[]> {
	const fields = 'f2,f3,f6,f8,f12,f14,f62,f104,f105,f111,f128,f136,f140'
	const all: SectorItem[] = []
	const seen = new Set<string>()
	let fetched = 0
	for (let pn = 1; pn <= 8; pn++) {
		const url = `/api/qt/clist/get?pn=${pn}&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:${t}+f:!50&fields=${fields}`
		const json = await fetchEastmoneyPush2<EmListResponse>(url)
		const rows = emRows(json)
		fetched += rows.length
		for (const item of parseEastmoneyBoards(json, level)) {
			if (!seen.has(item.code)) {
				seen.add(item.code)
				all.push(item)
			}
		}
		if (rows.length === 0 || fetched >= (json.data?.total ?? 0)) break
	}
	if (all.length === 0) throw new Error('eastmoney clist: empty list')
	return all
}

// ───────────────────────── 东财 ulist（指数 / 指定代码批量） ─────────────────────────

export interface QuoteRow {
	/** 东财 secid（market.code）或腾讯/Naver 代码 */
	key: string
	code: string
	name: string
	price: number | null
	change: number | null
	changePct: number | null
	amount: number | null
	quoteTime: number | null
	delayMinutes: number
	/** 东财 f62 主力净流入（元）；指数 / 美股 ETF 有，港股指数、腾讯/Naver 行情没有 */
	netInflow?: number | null
}

export function parseEastmoneyUlist(json: EmListResponse): QuoteRow[] {
	return emRows(json).map((r) => {
		const ts = num(r.f124)
		return {
			key: `${r.f13}.${r.f12}`,
			code: String(r.f12),
			name: String(r.f14),
			price: num(r.f2),
			change: num(r.f4),
			changePct: num(r.f3),
			amount: num(r.f6),
			quoteTime: ts ? ts * 1000 : null,
			delayMinutes: 0,
			netInflow: num(r.f62),
		}
	})
}

export async function fetchEastmoneyUlist(secids: string[]): Promise<QuoteRow[]> {
	const path = `/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f6,f12,f13,f14,f62,f124&secids=${secids.join(',')}`
	const rows = parseEastmoneyUlist(await fetchEastmoneyPush2<EmListResponse>(path))
	if (rows.length === 0) throw new Error('eastmoney ulist: empty')
	return rows
}

// ───────────────────────── 腾讯 qt 报价 ─────────────────────────

/** 腾讯 qt 时间字段：A股 20260930161500 / 港股 2026/10/06 14:42:52 / 美股 2026-10-05 16:00:01（美东） */
export function parseTencentTime(prefix: string, value: string): number | null {
	const m = value.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})\s*(\d{2}):?(\d{2}):?(\d{2})$/)
	if (!m) return null
	const tz =
		prefix === 'us' ? 'America/New_York' : prefix === 'hk' ? 'Asia/Hong_Kong' : 'Asia/Shanghai'
	const [, y, mo, d, h, mi, s] = m.map(Number)
	return zonedTimeToTs(tz, y, mo, d, h, mi, s)
}

export function parseTencentQt(text: string): QuoteRow[] {
	const rows: QuoteRow[] = []
	for (const line of text.split(';')) {
		const match = line.trim().match(/^v_(sh|sz|bj|hk|us)([^=]+)="([^"]*)"$/)
		if (!match) continue
		const [, prefix, rest, body] = match
		const f = body.split('~')
		if (f.length < 38) continue
		const amount = num(f[37])
		rows.push({
			key: `${prefix}${rest}`,
			code: rest,
			name: f[1],
			price: num(f[3]),
			change: num(f[31]),
			changePct: num(f[32]),
			// 美股 [37] 为美元成交额；A股/港股口径不同，这里只给美股用
			amount: prefix === 'us' ? amount : null,
			quoteTime: parseTencentTime(prefix, f[30] || ''),
			delayMinutes: prefix === 'hk' ? 15 : 0,
		})
	}
	return rows
}

export async function fetchTencentQt(codes: string[]): Promise<QuoteRow[]> {
	const text = await fetchText(`https://qt.gtimg.cn/q=${codes.join(',')}`, {
		encoding: 'gbk',
		headers: TENCENT_HEADERS,
	})
	const rows = parseTencentQt(text)
	if (rows.length === 0) throw new Error('tencent qt: empty')
	return rows
}

// ───────────────────────── Naver（韩国 / 日本） ─────────────────────────

interface NaverGroupsResponse {
	totalCount?: number
	groups?: Array<{
		no: number
		name: string
		totalCount?: number
		changeRate?: string
		riseCount?: number
		fallCount?: number
	}>
}

export function parseNaverGroups(
	json: NaverGroupsResponse,
	translate?: Record<string, string>,
): { items: SectorItem[]; total: number } {
	const items = (json.groups || []).map((g) => {
		const zh = translate?.[g.name]
		return {
			...emptySector(String(g.no), zh || g.name),
			...(zh ? { rawName: g.name } : {}),
			changePct: num(g.changeRate),
			upCount: num(g.riseCount),
			downCount: num(g.fallCount),
			total: num(g.totalCount),
		}
	})
	return { items, total: json.totalCount ?? items.length }
}

export async function fetchNaverGroups(
	type: 'industry' | 'theme',
	translate?: Record<string, string>,
): Promise<SectorItem[]> {
	const pageSize = 100
	const seen = new Map<string, SectorItem>()
	for (let page = 1; page <= 6; page++) {
		const url = `https://m.stock.naver.com/api/stocks/${type}?page=${page}&pageSize=${pageSize}`
		let json: NaverGroupsResponse
		try {
			json = await fetchJson<NaverGroupsResponse>(url, { headers: NAVER_HEADERS, retries: 1 })
		} catch (err) {
			// 越界页 Naver 返回 404；翻页期间排序变动也可能导致页间重复，已拿到的页不丢
			if (page > 1 && seen.size > 0) break
			throw err
		}
		const { items, total } = parseNaverGroups(json, translate)
		for (const item of items) seen.set(item.code, item)
		if (items.length < pageSize || seen.size >= total) break
	}
	if (seen.size === 0) throw new Error(`naver ${type}: empty`)
	return [...seen.values()]
}

interface NaverPollingResponse {
	datas?: Array<Record<string, unknown>>
}

export function parseNaverPolling(json: NaverPollingResponse): QuoteRow[] {
	return (json.datas || []).map((d) => {
		const exchange = d.stockExchangeType as { delayTime?: number } | undefined
		const code = String(d.itemCode ?? d.reutersCode ?? d.symbolCode ?? '')
		const tradedAt = typeof d.localTradedAt === 'string' ? Date.parse(d.localTradedAt) : Number.NaN
		return {
			key: code,
			code,
			name: String(d.stockName ?? d.indexName ?? code),
			price: num(d.closePriceRaw ?? d.closePrice),
			change: num(d.compareToPreviousClosePriceRaw ?? d.compareToPreviousClosePrice),
			changePct: num(d.fluctuationsRatioRaw ?? d.fluctuationsRatio),
			amount: num(d.accumulatedTradingValueRaw),
			quoteTime: Number.isFinite(tradedAt) ? tradedAt : null,
			delayMinutes: exchange?.delayTime ?? 0,
		}
	})
}

export async function fetchNaverPolling(
	path: 'domestic/index' | 'worldstock/stock' | 'worldstock/index',
	codes: string[],
): Promise<QuoteRow[]> {
	const url = `https://polling.finance.naver.com/api/realtime/${path}/${codes.map(encodeURIComponent).join(',')}`
	const rows = parseNaverPolling(
		await fetchJson<NaverPollingResponse>(url, { headers: NAVER_HEADERS, retries: 1 }),
	)
	if (rows.length === 0) throw new Error(`naver ${path}: empty`)
	return rows
}

interface NaverIndexTrendResponse {
	bizdate?: string
	personalValue?: string
	foreignValue?: string
	institutionalValue?: string
}

/** Naver 韩国指数投资者动向：单位 억원（1e8 KRW），"+7,545" / "-17,665" */
export function parseNaverIndexTrend(json: NaverIndexTrendResponse) {
	const won = (v: unknown) => {
		const n = num(typeof v === 'string' ? v.replace('+', '') : v)
		return n == null ? null : n * 1e8
	}
	return {
		date: json.bizdate || null,
		foreign: won(json.foreignValue),
		institutional: won(json.institutionalValue),
		personal: won(json.personalValue),
	}
}

export async function fetchNaverIndexTrend(code: string) {
	const json = await fetchJson<NaverIndexTrendResponse>(
		`https://m.stock.naver.com/api/index/${encodeURIComponent(code)}/trend`,
		{ headers: NAVER_HEADERS, retries: 1 },
	)
	return parseNaverIndexTrend(json)
}

export const toIndexQuote = (row: QuoteRow, name?: string): MarketIndexQuote => ({
	code: row.code,
	name: name || row.name,
	price: row.price,
	change: row.change,
	changePct: row.changePct,
	quoteTime: row.quoteTime,
	delayMinutes: row.delayMinutes,
})
