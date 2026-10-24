import type { StockQuote } from '@briar/shared'
import { fetchText } from './http'
import { num, parseTencentTime } from './sources'
import { fetchTencentStockQuotes } from './stockSources'

const SINA_HEADERS = { Referer: 'https://finance.sina.com.cn/' }

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** 新浪港股字段：2 开 3 昨收 4 高 5 低 6 现价 7 涨跌 8 涨跌幅 11 成交额 12 成交量 17/18 时间 */
export function parseSinaHkStockQuotes(text: string): StockQuote[] {
	const out: StockQuote[] = []
	for (const line of text.split(';')) {
		const match = line.trim().match(/^(?:var\s+)?hq_str_rt_hk(\d{5})="([^"]*)"$/)
		if (!match) continue
		const [, code, body] = match
		const f = body.split(',')
		if (f.length < 19) continue
		const price = num(f[6])
		const prevClose = num(f[3])
		if (price == null && prevClose == null) continue
		out.push({
			market: 'hk',
			code,
			name: f[1] || code,
			price,
			change: num(f[7]),
			changePct: num(f[8]),
			prevClose,
			open: num(f[2]),
			high: num(f[4]),
			low: num(f[5]),
			amount: num(f[11]),
			volume: num(f[12]),
			turnoverRate: null,
			marketCap: null,
			pe: num(f[13]),
			pb: null,
			currency: 'HKD',
			quoteTime: parseTencentTime('hk', `${f[17]} ${f[18]}`),
			delayMinutes: 0,
			source: '新浪行情 rt_hk',
		})
	}
	return out
}

export async function fetchSinaHkStockQuotes(codes: string[]): Promise<StockQuote[]> {
	if (codes.length === 0) return []
	const list = codes.map((code) => `rt_hk${code}`).join(',')
	const text = await fetchText(`https://hq.sinajs.cn/list=${list}`, {
		encoding: 'gbk',
		headers: SINA_HEADERS,
	})
	const quotes = parseSinaHkStockQuotes(text)
	if (quotes.length === 0) throw new Error('sina hk stock quotes: empty')
	return quotes
}

export function mergeHkStockQuotes(
	codes: string[],
	primary: StockQuote[],
	fallback: StockQuote[],
): StockQuote[] {
	const sina = new Map(primary.filter((q) => q.market === 'hk').map((q) => [q.code, q]))
	const tencent = new Map(fallback.filter((q) => q.market === 'hk').map((q) => [q.code, q]))
	return [...new Set(codes)].flatMap((code) => {
		const delayed = tencent.get(code)
		const quote = sina.get(code)
		if (!quote) return delayed ? [delayed] : []
		return [
			{
				...quote,
				name: delayed?.name || quote.name,
				turnoverRate: delayed?.turnoverRate ?? null,
				marketCap: delayed?.marketCap ?? null,
				pe: quote.pe ?? delayed?.pe ?? null,
				pb: delayed?.pb ?? null,
			},
		]
	})
}

export async function fetchHkStockQuotes(codes: string[]): Promise<StockQuote[]> {
	const unique = [...new Set(codes)]
	if (unique.length === 0) return []
	const [sina, tencent] = await Promise.allSettled([
		fetchSinaHkStockQuotes(unique),
		fetchTencentStockQuotes(unique.map((code) => ({ market: 'hk', code }))),
	])
	if (sina.status === 'rejected' && tencent.status === 'rejected') {
		throw new Error(
			`新浪港股行情: ${errorMessage(sina.reason)}; 腾讯港股行情: ${errorMessage(tencent.reason)}`,
		)
	}
	return mergeHkStockQuotes(
		unique,
		sina.status === 'fulfilled' ? sina.value : [],
		tencent.status === 'fulfilled' ? tencent.value : [],
	)
}
