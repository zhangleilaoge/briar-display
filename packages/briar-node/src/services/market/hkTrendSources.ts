import type { StockQuote } from '@briar/shared'
import { fetchSinaHkStockQuotes } from './hkStockSources'
import { fetchJson } from './http'
import { localParts } from './session'
import { num } from './sources'
import { type RawTrend, normalizePoints, parseLocalStamp } from './trendSources'

const SINA_HEADERS = { Referer: 'https://finance.sina.com.cn/' }
const HK_TIME_ZONE = 'Asia/Hong_Kong'

interface SinaHkMinuteResponse {
	result?: {
		status?: { code?: number; msg?: string }
		data?: Array<{ m?: string; v?: string; p?: string }>
	}
}

export function parseSinaHkStockMinute(json: SinaHkMinuteResponse, quote: StockQuote): RawTrend {
	const status = json.result?.status
	if (status?.code !== 0) throw new Error(`sina hk minute: ${status?.msg || 'invalid response'}`)
	const date = quote.quoteTime == null ? null : localParts(quote.quoteTime, HK_TIME_ZONE).dateKey
	const points = date
		? (json.result?.data || []).flatMap((row) => {
				const ts = parseLocalStamp(`${date} ${row.m || ''}`, HK_TIME_ZONE)
				const price = num(row.p)
				return ts == null || price == null
					? []
					: [[ts, price, num(row.v)] satisfies RawTrend['points'][number]]
			})
		: []
	return {
		name: quote.name,
		prevClose: quote.prevClose,
		points: normalizePoints(points),
		delayMinutes: 0,
		source: '新浪港股分时',
	}
}

export async function fetchSinaHkStockMinute(code: string): Promise<RawTrend> {
	const [json, quotes] = await Promise.all([
		fetchJson<SinaHkMinuteResponse>(
			`https://stock.finance.sina.com.cn/hkstock/api/openapi.php/HK_StockService.getHKMinline?symbol=${encodeURIComponent(code)}`,
			{ headers: SINA_HEADERS },
		),
		fetchSinaHkStockQuotes([code]),
	])
	const quote = quotes.find((q) => q.code === code)
	if (!quote) throw new Error(`sina hk minute ${code}: quote empty`)
	const trend = parseSinaHkStockMinute(json, quote)
	if (trend.points.length === 0) throw new Error(`sina hk minute ${code}: empty`)
	return trend
}
