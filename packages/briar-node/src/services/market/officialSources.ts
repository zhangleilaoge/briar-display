import { type IndexDef, JP_TOPIX17_INDICES, MARKET_INDICES } from './catalog'
import { fetchJson, fetchText } from './http'
import { zonedTimeToTs } from './session'
import { type QuoteRow, num } from './sources'

const HSI_URL =
	'https://www.hsi.com.hk/api/wsit-hsi-ddoc-ea-public-website-proxy/v1/product-data/pub/series/metadata/v2'
const JPX_SNAPSHOT_URL = 'https://www.jpx.co.jp/market/indices/e_indices_stock_price3.txt'
const JPX_TIME_URL = 'https://www.jpx.co.jp/market/indices/e_indices_stock_price3.time.txt'
const JPX_HEADERS = { Referer: 'https://www.jpx.co.jp/market/indices/' }
const SINA_HEADERS = { Referer: 'https://finance.sina.com.cn/' }

interface HsiResponse {
	code?: string
	message?: string
	data?: Array<{
		indexCode?: string
		indexName?: string
		indexShortName?: string
		indexValue?: string
		changeValue?: string
		changePercentage?: string
		indexTime?: string
	}>
}

function localTimestamp(value: string, timeZone: string): number | null {
	const match = value
		.trim()
		.match(/^(\d{4})-?(\d{2})-?(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?|(\d{2})(\d{2})(\d{2})?)?$/)
	if (!match) return null
	const [y, mo, d, h1, mi1, s1, h2, mi2, s2] = match.slice(1)
	return zonedTimeToTs(
		timeZone,
		Number(y),
		Number(mo),
		Number(d),
		Number(h1 ?? h2 ?? 0),
		Number(mi1 ?? mi2 ?? 0),
		Number(s1 ?? s2 ?? 0),
	)
}

function validQuote(row: QuoteRow): QuoteRow {
	if (row.price == null || row.price <= 0 || row.quoteTime == null) {
		throw new Error(`${row.key}: invalid price or quote time`)
	}
	return row
}

export function parseHsiQuote(json: HsiResponse, def: IndexDef): QuoteRow {
	if (json.code !== '0') throw new Error(`hsi: ${json.message || json.code || 'unknown error'}`)
	if (!def.hsi) throw new Error(`${def.name}: missing HSI source config`)
	const row = json.data?.find((item) => item.indexCode === def.hsi?.code)
	if (!row) throw new Error(`hsi: ${def.hsi.code} not found`)
	return validQuote({
		key: `hsi:${def.hsi.series}`,
		code: def.em || def.hsi.code,
		name: row.indexShortName || row.indexName || def.name,
		price: num(row.indexValue),
		change: num(row.changeValue),
		changePct: num(row.changePercentage),
		amount: null,
		quoteTime: localTimestamp(row.indexTime || '', 'Asia/Hong_Kong'),
		delayMinutes: 0,
	})
}

export async function fetchHsiQuote(def: IndexDef): Promise<QuoteRow> {
	if (!def.hsi) throw new Error(`${def.name}: missing HSI source config`)
	const query = new URLSearchParams({
		data: 'values',
		seriesCode: def.hsi.series,
		language: 'en-hk',
	})
	return parseHsiQuote(await fetchJson<HsiResponse>(`${HSI_URL}?${query}`), def)
}

export async function fetchHsiQuotes(defs: IndexDef[]): Promise<QuoteRow[]> {
	const settled = await Promise.allSettled(defs.filter((def) => def.hsi).map(fetchHsiQuote))
	const rows = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
	if (rows.length === 0) {
		throw new Error(
			settled
				.map((result) => (result.status === 'rejected' ? String(result.reason) : ''))
				.filter(Boolean)
				.join('; ') || 'hsi: empty',
		)
	}
	return rows
}

interface JpxQuoteRow {
	marketName?: string
	currentPrice?: string
	previousDayComparison?: string
	previousDayRatio?: string
	RealtimeGraphURL?: string
}

interface JpxSnapshot {
	MainStockIndex?: Record<string, JpxQuoteRow>
	IndustryTypeStockIndex?: Record<string, JpxQuoteRow>
}

export interface JpxQuoteTarget {
	code: string
	group: 'main' | 'industry'
	key: string
	qcode: string
}

export const JPX_QUOTE_TARGETS: JpxQuoteTarget[] = [
	...MARKET_INDICES.jp.flatMap((def) =>
		def.jpx
			? [
					{
						code: def.naver?.code || def.name,
						group: 'main' as const,
						key: def.jpx.key,
						qcode: def.jpx.code,
					},
				]
			: [],
	),
	...JP_TOPIX17_INDICES.map((def) => ({
		code: def.code,
		group: 'industry' as const,
		key: def.jpxKey,
		qcode: def.jpxCode,
	})),
]

export function parseJpxTime(value: string): number | null {
	return localTimestamp(value, 'Asia/Tokyo')
}

export function parseJpxQuotes(
	json: JpxSnapshot,
	timeText: string,
	targets: JpxQuoteTarget[] = JPX_QUOTE_TARGETS,
): QuoteRow[] {
	const quoteTime = parseJpxTime(timeText)
	if (quoteTime == null) throw new Error(`jpx: invalid quote time ${timeText}`)
	const rows = targets.flatMap((target) => {
		const group = target.group === 'main' ? json.MainStockIndex : json.IndustryTypeStockIndex
		const row = group?.[target.key]
		if (!row?.RealtimeGraphURL?.includes(`qcode=${target.qcode}`)) return []
		return [
			{
				key: `jpx:${target.qcode}`,
				code: target.code,
				name: row.marketName || target.key,
				price: num(row.currentPrice),
				change: num(row.previousDayComparison),
				changePct: num(row.previousDayRatio),
				amount: null,
				quoteTime,
				delayMinutes: 0,
			},
		]
	})
	if (rows.length === 0) throw new Error('jpx: no configured indices')
	return rows.map(validQuote)
}

export async function fetchJpxQuotes(): Promise<QuoteRow[]> {
	const [snapshot, timeText] = await Promise.all([
		fetchJson<JpxSnapshot>(JPX_SNAPSHOT_URL, { headers: JPX_HEADERS }),
		fetchText(JPX_TIME_URL, { headers: JPX_HEADERS }),
	])
	return parseJpxQuotes(snapshot, timeText)
}

export function parseSinaNikkei(text: string): QuoteRow {
	const match = text.match(/(?:^|;)\s*var\s+hq_str_znb_NKY="([^"]*)"/)
	const fields = match?.[1].split(',') || []
	if (fields.length < 8) throw new Error('sina znb_NKY: invalid response')
	const date = fields[6]
	const time = fields[7]
	return validQuote({
		key: 'sina:znb_NKY',
		code: '100.N225',
		name: fields[0] || '日经225',
		price: num(fields[1]),
		change: num(fields[2]),
		changePct: num(fields[3]),
		amount: null,
		quoteTime: localTimestamp(`${date} ${time}`, 'Asia/Shanghai'),
		delayMinutes: 0,
	})
}

export async function fetchSinaNikkei(): Promise<QuoteRow> {
	const text = await fetchText('https://hq.sinajs.cn/list=znb_NKY', {
		encoding: 'gbk',
		headers: SINA_HEADERS,
	})
	return parseSinaNikkei(text)
}
