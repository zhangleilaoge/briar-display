import { cachedLoad } from './cache'
import {
	CSI300_ETFS,
	type Csi300IndexDay,
	assertCompletedMonth,
	assertDate,
	createSnapshot,
	monthBounds,
	monthKey,
	positiveNumber,
	shanghaiDate,
	wanSharesToShares,
	yiYuanToYuan,
} from './csi300EtfScale'
import { fetchJson, fetchText } from './http'

const SSE_URL = 'https://query.sse.com.cn/commonQuery.do'
const SSE_HEADERS = { Referer: 'https://www.sse.com.cn/' }
const SZSE_URL = 'https://www.szse.cn/api/report/ShowReport/data'
const SZSE_HEADERS = { Referer: 'https://www.szse.cn/market/fund/volume/etf/index.html' }
const MONTH_CACHE_MS = 6 * 60 * 60_000
const NAV_CACHE_MS = 24 * 60 * 60_000
const SSE_CODES = CSI300_ETFS.filter((fund) => fund.exchange === 'sse').map((fund) => fund.code)

interface SseEtfResponse {
	result?: { STAT_DATE?: string; SEC_CODE?: string; TOT_VOL?: string }[]
}

export function parseSseEtfShares(json: SseEtfResponse, date: string): Record<string, number> {
	assertDate(date)
	if (!Array.isArray(json.result)) throw new Error('上交所 ETF 规模响应格式错误')
	const result: Record<string, number> = {}
	for (const code of SSE_CODES) {
		const rows = json.result.filter((row) => row.SEC_CODE === code)
		if (rows.length !== 1 || rows[0].STAT_DATE !== date) {
			throw new Error(`${date} 上交所缺少 ${code} 当日份额`)
		}
		result[code] = wanSharesToShares(rows[0].TOT_VOL ?? '')
	}
	return result
}

export async function fetchSseEtfShares(date: string): Promise<Record<string, number>> {
	assertDate(date)
	const query = new URLSearchParams({
		isPagination: 'true',
		'pageHelp.pageSize': '10000',
		'pageHelp.pageNo': '1',
		'pageHelp.beginPage': '1',
		'pageHelp.cacheSize': '1',
		'pageHelp.endPage': '1',
		sqlId: 'COMMON_SSE_ZQPZ_ETFZL_XXPL_ETFGM_SEARCH_L',
		STAT_DATE: date,
	})
	const json = await fetchJson<SseEtfResponse>(`${SSE_URL}?${query}`, {
		headers: SSE_HEADERS,
		timeoutMs: 15_000,
		retries: 1,
	})
	return parseSseEtfShares(json, date)
}

interface SzseSharePage {
	metadata?: { pagecount?: number }
	data?: { size_date?: string; fund_code?: string; current_size?: string }[]
}

export function parseSzseSharePage(json: SzseSharePage[]) {
	const page = json[0]
	if (!page || !Array.isArray(page.data)) throw new Error('深交所 ETF 规模响应格式错误')
	const shares: Record<string, number> = {}
	for (const row of page.data) {
		if (row.fund_code !== '159919') continue
		const date = assertDate(row.size_date ?? '')
		if (shares[date] !== undefined) throw new Error(`${date} 深交所返回重复份额`)
		shares[date] = wanSharesToShares((row.current_size ?? '').replaceAll(',', ''))
	}
	return { shares, pageCount: Math.max(1, Number(page.metadata?.pagecount) || 1) }
}

async function fetchSzseSharePage(start: string, end: string, pageNo: number) {
	const query = new URLSearchParams({
		SHOWTYPE: 'JSON',
		CATALOGID: 'scsj_fund_jjgm',
		TABKEY: 'tab1',
		txtStart: start,
		txtEnd: end,
		jjlb: 'ETF',
		txtDm: '159919',
		PAGENO: String(pageNo),
	})
	return parseSzseSharePage(
		await fetchJson<SzseSharePage[]>(`${SZSE_URL}?${query}`, {
			headers: SZSE_HEADERS,
			timeoutMs: 15_000,
			retries: 1,
		}),
	)
}

export async function fetchSzseEtfShares(month: string): Promise<Record<string, number>> {
	assertCompletedMonth(month)
	const { start, end } = monthBounds(month)
	const first = await fetchSzseSharePage(start, end, 1)
	const shares = { ...first.shares }
	for (let pageNo = 2; pageNo <= first.pageCount; pageNo++) {
		const next = await fetchSzseSharePage(start, end, pageNo)
		for (const [date, value] of Object.entries(next.shares)) {
			if (shares[date] !== undefined) throw new Error(`${date} 深交所分页返回重复份额`)
			shares[date] = value
		}
	}
	return shares
}

export function parseNavTrend(
	script: string,
): Record<string, { date: string; unitNav: number; cumulativeNav: number }> {
	const unitMatch = /\bvar\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/.exec(script)
	if (!unitMatch) throw new Error('基金净值响应缺少 Data_netWorthTrend')
	const cumulativeMatch = /\bvar\s+Data_ACWorthTrend\s*=\s*(\[[\s\S]*?\]);/.exec(script)
	if (!cumulativeMatch) throw new Error('基金净值响应缺少 Data_ACWorthTrend')
	const unitRows: unknown = JSON.parse(unitMatch[1])
	const cumulativeRows: unknown = JSON.parse(cumulativeMatch[1])
	if (!Array.isArray(unitRows) || !Array.isArray(cumulativeRows)) {
		throw new Error('基金净值格式错误')
	}
	const cumulativeByTimestamp = new Map<number, number>()
	for (const row of cumulativeRows) {
		if (!Array.isArray(row) || row.length < 2) throw new Error('基金累计净值行格式错误')
		const [timestamp, value] = row as [number, number]
		const date = shanghaiDate(timestamp)
		cumulativeByTimestamp.set(timestamp, positiveNumber(value, `${date} 累计净值`))
	}
	const result: Record<string, { date: string; unitNav: number; cumulativeNav: number }> = {}
	for (const row of unitRows) {
		if (typeof row !== 'object' || row === null) throw new Error('基金单位净值行格式错误')
		const { x, y } = row as { x?: number; y?: number }
		const date = shanghaiDate(x ?? Number.NaN)
		const cumulativeNav = cumulativeByTimestamp.get(x ?? Number.NaN)
		if (cumulativeNav === undefined) throw new Error(`${date} 缺少当日累计净值`)
		result[date] = {
			date,
			unitNav: positiveNumber(y ?? Number.NaN, `${date} 单位净值`),
			cumulativeNav,
		}
	}
	return result
}

export async function fetchNavTrend(code: string) {
	if (!CSI300_ETFS.some((fund) => fund.code === code)) throw new Error(`不在样本内的基金: ${code}`)
	const result = await cachedLoad(`csi300:nav:${code}`, NAV_CACHE_MS, () =>
		fetchText(`https://fund.eastmoney.com/pingzhongdata/${code}.js`, {
			headers: { Referer: `https://fund.eastmoney.com/${code}.html` },
			timeoutMs: 15_000,
			retries: 1,
		}).then(parseNavTrend),
	)
	return result.value
}

interface SseIndexResponse {
	result?: { MDATE?: string; CLS?: string; CPT_NGT?: string }[]
}

export function parseSseIndexMonth(json: SseIndexResponse, month: string): Csi300IndexDay[] {
	monthBounds(month)
	if (!Array.isArray(json.result)) throw new Error('沪深300月报响应格式错误')
	const dates = new Set<string>()
	return json.result
		.map((row) => {
			const raw = row.MDATE ?? ''
			const date = assertDate(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`)
			if (monthKey(date) !== month) throw new Error(`沪深300月报日期越界: ${date}`)
			if (dates.has(date)) throw new Error(`沪深300月报日期重复: ${date}`)
			dates.add(date)
			return {
				date,
				indexClose: positiveNumber(row.CLS ?? '', `${date} 沪深300收盘`),
				floatMarketCap: yiYuanToYuan(row.CPT_NGT ?? ''),
			}
		})
		.sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchSseIndexMonth(month: string): Promise<Csi300IndexDay[]> {
	assertCompletedMonth(month)
	const result = await cachedLoad(`csi300:index:${month}`, MONTH_CACHE_MS, async () => {
		const query = new URLSearchParams({
			sqlId: 'COMMON_SSE_ZQZS_M_CSI300_INDEX_C',
			isPagination: 'false',
			MDATE: month,
		})
		const json = await fetchJson<SseIndexResponse>(`${SSE_URL}?${query}`, {
			headers: SSE_HEADERS,
			timeoutMs: 15_000,
			retries: 1,
		})
		return parseSseIndexMonth(json, month)
	})
	return result.value
}

export async function fetchNavTrends() {
	const entries = await Promise.all(
		CSI300_ETFS.map(async (fund) => [fund.code, await fetchNavTrend(fund.code)] as const),
	)
	return Object.fromEntries(entries) as Record<
		string,
		Record<string, { date: string; unitNav: number; cumulativeNav: number }>
	>
}

export async function fetchCompletedMonthSnapshots(month: string) {
	assertCompletedMonth(month)
	const indices = await fetchSseIndexMonth(month)
	if (indices.length === 0) return []
	const { start, end } = monthBounds(month)
	const [szseShares, navTrends] = await Promise.all([fetchSzseEtfShares(month), fetchNavTrends()])
	const snapshots = []
	for (const index of indices) {
		if (index.date < start || index.date > end) throw new Error(`月份日期越界: ${index.date}`)
		const sseShares = await fetchSseEtfShares(index.date)
		await new Promise((resolve) => setTimeout(resolve, 80))
		const sharesByCode = { ...sseShares, '159919': szseShares[index.date] }
		const navByCode = Object.fromEntries(
			CSI300_ETFS.map((fund) => [fund.code, navTrends[fund.code][index.date]]),
		)
		snapshots.push(createSnapshot(index, sharesByCode, navByCode))
	}
	return snapshots
}
