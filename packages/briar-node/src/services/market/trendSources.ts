import type { Candle, MinutePoint } from '@briar/shared'
import { fetchJson, fetchText } from './http'
import { localParts, zonedTimeToTs } from './session'
import { num } from './sources'

/**
 * 走势数据源（2026-10 实测）：
 * 分时
 * - 腾讯 web.ifzq.gtimg.cn/appstock/app/minute/query：A股指数 / A股板块（pt 开头的板块代码可直接查，无需映射）/ 港股主要指数，
 *   data 为 "HHMM 价格 累计量 …"，qt[code][4] 为昨收；港股恒指/科指/国指实时
 * - 腾讯 appstock/app/UsMinute/query：美股指数（qt[0]=real，实时）/ 美股 ETF（qt[0]=delay，延迟），时间为美东
 * - Naver m.stock.naver.com/front-api/chart/pricesByPeriod（scriptChartType=day）：日本指数 / 东证 ETF，
 *   当地时间，含 lastClosePrice、累计量；ETF 成交稀疏只有有成交的分钟才有点；东证行情 15 分钟延迟
 * - Naver api.stock.naver.com/chart/domestic/index/{KOSPI|KOSDAQ|KPI200}/minute：韩国指数实时（每分钟量，不含昨收）
 * - 东财 push2his trends2：覆盖最全（A股板块 90.BK / 恒生行业 124.HSCI* / 美股 105~107），
 *   但同 IP 连续十几次就会被 Empty reply 封一段时间，只用于腾讯/Naver 没有的恒生行业指数和兜底
 * - 韩国业种 / 主题：Naver 无分时接口（试过 chart/domestic/upjong|industry|theme 均 400 / 空）
 * 五日
 * - 腾讯 appstock/app/day/query（A股指数 / pt 板块 / 港股指数）、dayus/query（美股），每天带 prec（昨收）
 * - Naver 韩国指数 minute?startDateTime=&endDateTime= 可取多日；日本（Naver 外国 minute 恒为空）没有多日分时
 * - 东财 trends2 ndays=5（恒生行业）
 * K 线（日/周/月，前复权）
 * - 腾讯 appstock/app/newfqkline/get?param=CODE,day|week|month,,,N,qfq：A股指数 / pt 板块 / 港股指数 / 美股
 *   （美股代码要带交易所后缀：us.INX、usXLK.AM，后缀取 qt 第 3 段；旧 fqkline 对 pt 板块只回 1 根）
 * - Naver chart/domestic/index/{code}/{day|week|month}、chart/foreign/{index|item}/{code}/{…}（带起止时间）：日韩
 * - 东财 push2his kline/get klt=101/102/103&fqt=1（恒生行业；腾讯 hkHSCI* 无数据）
 */

export interface RawTrend {
	name: string | null
	prevClose: number | null
	points: MinutePoint[]
	delayMinutes: number
	source: string
}

export interface RawDay {
	date: string
	prevClose: number | null
	points: MinutePoint[]
}

export interface RawMultiDay {
	name: string | null
	days: RawDay[]
	delayMinutes: number
	source: string
}

export type KlinePeriod = 'day' | 'week' | 'month'

export interface RawCandles {
	name: string | null
	candles: Candle[]
	source: string
}

const TENCENT_HEADERS = { Referer: 'https://gu.qq.com/' }
const NAVER_HEADERS = { Referer: 'https://m.stock.naver.com/' }
const EM_HEADERS = { Referer: 'https://quote.eastmoney.com/' }

/** 当地时间串 → 时间戳：20261006153000 / 202610061530 / 2026-10-06 15:30 */
export function parseLocalStamp(value: string, timeZone: string): number | null {
	const m = value.trim().match(/^(\d{4})-?(\d{2})-?(\d{2})\s*(\d{2}):?(\d{2})(?::?(\d{2}))?$/)
	if (!m) return null
	const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v || 0))
	return zonedTimeToTs(timeZone, y, mo, d, h, mi, s)
}

/** 排序 + 同一时间戳去重（保留最后一个）+ 丢弃非法价格 */
export function normalizePoints(points: MinutePoint[]): MinutePoint[] {
	const byTs = new Map<number, MinutePoint>()
	for (const p of points) {
		if (Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > 0) byTs.set(p[0], p)
	}
	return [...byTs.values()].sort((a, b) => a[0] - b[0])
}

/** 累计成交量 → 每分钟成交量（源偶尔回退一点，截成 0） */
export function cumulativeToDelta(points: MinutePoint[]): MinutePoint[] {
	let prev: number | null = null
	return points.map(([ts, price, cum]) => {
		if (cum == null) return [ts, price, null]
		const v = prev == null ? cum : Math.max(0, cum - prev)
		prev = Math.max(prev ?? 0, cum)
		return [ts, price, v]
	})
}

/** 按当地交易日分组（升序） */
export function groupByDay(points: MinutePoint[], timeZone: string): RawDay[] {
	const days: RawDay[] = []
	for (const p of points) {
		const date = localParts(p[0], timeZone).dateKey
		const last = days[days.length - 1]
		if (last && last.date === date) last.points.push(p)
		else days.push({ date, prevClose: null, points: [p] })
	}
	return days
}

/** 多日分时：缺昨收的日子用前一天最后一笔补；返回最近 n 天 */
export function chainPrevClose(days: RawDay[], n: number): RawDay[] {
	const out = days.map((d, i) => {
		if (d.prevClose != null || i === 0) return d
		const prev = days[i - 1].points
		return { ...d, prevClose: prev[prev.length - 1]?.[1] ?? null }
	})
	return out.slice(-n)
}

const yyyymmdd = (dateKey: string) => dateKey.replace(/-/g, '')
const dashDate = (value: string) =>
	/^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value

/** 清洗 K 线：丢弃非法行、按日期升序去重 */
export function normalizeCandles(candles: Candle[]): Candle[] {
	const byDate = new Map<string, Candle>()
	for (const c of candles) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(c[0])) continue
		if (![c[1], c[2], c[3], c[4]].every((v) => Number.isFinite(v) && v > 0)) continue
		byDate.set(c[0], c)
	}
	return [...byDate.values()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
}

// ───────────────────────── 腾讯 ─────────────────────────

/** "HHMM 价格 累计量 [额]" → 分钟点（量已转成每分钟） */
export function parseTencentMinuteLines(
	date: string,
	lines: string[] | undefined,
	timeZone: string,
): MinutePoint[] {
	if (!/^\d{8}$/.test(date)) return []
	const points: MinutePoint[] = []
	for (const line of lines || []) {
		const [hhmm, price, vol] = line.trim().split(/\s+/)
		if (!/^\d{4}$/.test(hhmm)) continue
		const ts = parseLocalStamp(`${date}${hhmm}`, timeZone)
		const p = num(price)
		if (ts != null && p != null) points.push([ts, p, num(vol)])
	}
	return cumulativeToDelta(normalizePoints(points))
}

type TencentQt = Record<string, unknown> | undefined

const qtFields = (qt: TencentQt, code: string): string[] => {
	const v = qt?.[code]
	return Array.isArray(v) ? (v as string[]) : []
}

/** 美股 qt[0]：real = 实时（指数），delay = 延迟报价（个股/ETF，按 15 分钟计） */
const tencentDelay = (fields: string[]) => (fields[0] === 'delay' ? 15 : 0)

interface TencentMinuteResponse {
	code?: number
	data?: Record<string, { data?: { date?: string; data?: string[] }; qt?: TencentQt } | undefined>
}

export function parseTencentMinute(
	json: TencentMinuteResponse,
	code: string,
	timeZone: string,
): RawTrend {
	const entry = json.data?.[code]
	const fields = qtFields(entry?.qt, code)
	return {
		name: fields[1] || null,
		prevClose: num(fields[4]),
		points: parseTencentMinuteLines(entry?.data?.date || '', entry?.data?.data, timeZone),
		delayMinutes: tencentDelay(fields),
		source: '腾讯分时',
	}
}

/** A股 / 港股：sh000001、sz399006、hkHSI、pt01801780（腾讯板块代码） */
export async function fetchTencentMinute(code: string, timeZone: string): Promise<RawTrend> {
	const json = await fetchJson<TencentMinuteResponse>(
		`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${encodeURIComponent(code)}`,
		{ headers: TENCENT_HEADERS },
	)
	const trend = parseTencentMinute(json, code, timeZone)
	if (trend.points.length === 0) throw new Error(`tencent minute ${code}: empty`)
	return trend
}

/** 美股：usINX / usIXIC / usDJI / usXLK */
export async function fetchTencentUsMinute(code: string): Promise<RawTrend> {
	const json = await fetchJson<TencentMinuteResponse>(
		`https://web.ifzq.gtimg.cn/appstock/app/UsMinute/query?code=${encodeURIComponent(code)}`,
		{ headers: TENCENT_HEADERS },
	)
	const trend = parseTencentMinute(json, code, 'America/New_York')
	if (trend.points.length === 0) throw new Error(`tencent us minute ${code}: empty`)
	return trend
}

interface TencentFiveDayResponse {
	data?: Record<
		string,
		{ data?: { date?: string; prec?: string; data?: string[] }[]; qt?: TencentQt } | undefined
	>
}

export function parseTencentFiveDay(
	json: TencentFiveDayResponse,
	code: string,
	timeZone: string,
): RawMultiDay {
	const entry = json.data?.[code]
	const fields = qtFields(entry?.qt, code)
	const days: RawDay[] = (Array.isArray(entry?.data) ? entry.data : [])
		.map((d) => ({
			date: dashDate(d.date || ''),
			prevClose: num(d.prec),
			points: parseTencentMinuteLines(d.date || '', d.data, timeZone),
		}))
		.filter((d) => d.points.length > 0)
		.sort((a, b) => (a.date < b.date ? -1 : 1))
	return {
		name: fields[1] || null,
		days,
		delayMinutes: tencentDelay(fields),
		source: '腾讯五日分时',
	}
}

/** 五日分时：A股 / 港股 / 板块走 day/query，美股走 dayus/query */
export async function fetchTencentFiveDay(
	code: string,
	timeZone: string,
	us = false,
): Promise<RawMultiDay> {
	const json = await fetchJson<TencentFiveDayResponse>(
		`https://web.ifzq.gtimg.cn/appstock/app/${us ? 'dayus' : 'day'}/query?code=${encodeURIComponent(code)}`,
		{ headers: TENCENT_HEADERS },
	)
	const result = parseTencentFiveDay(json, code, us ? 'America/New_York' : timeZone)
	if (result.days.length === 0) throw new Error(`tencent 5day ${code}: empty`)
	return result
}

interface TencentKlineResponse {
	data?: Record<string, Record<string, unknown> | undefined>
}

/** 行：[日期, 开, 收, 高, 低, 量, …]（注意腾讯是开收高低） */
export function parseTencentKline(
	json: TencentKlineResponse,
	code: string,
	period: KlinePeriod,
): RawCandles {
	const entry = json.data?.[code]
	const rows = (entry?.[`qfq${period}`] ?? entry?.[period]) as unknown
	const candles: Candle[] = []
	for (const row of Array.isArray(rows) ? rows : []) {
		if (!Array.isArray(row)) continue
		const [date, o, c, h, l, v] = row
		const nums = [o, h, l, c].map(num)
		if (typeof date !== 'string' || nums.some((x) => x == null)) continue
		candles.push([date, nums[0], nums[1], nums[2], nums[3], num(v)] as Candle)
	}
	const qt = entry?.qt as TencentQt
	return {
		name: qtFields(qt, code)[1] || null,
		candles: normalizeCandles(candles),
		source: '腾讯K线',
	}
}

export async function fetchTencentKline(
	code: string,
	period: KlinePeriod,
	count: number,
): Promise<RawCandles> {
	const json = await fetchJson<TencentKlineResponse>(
		`https://web.ifzq.gtimg.cn/appstock/app/newfqkline/get?param=${encodeURIComponent(code)},${period},,,${count},qfq`,
		{ headers: TENCENT_HEADERS },
	)
	const result = parseTencentKline(json, code, period)
	// 美股不带交易所后缀、pt 板块走旧接口时只回 1 根，按失败处理
	if (result.candles.length < 2) throw new Error(`tencent kline ${code}: empty`)
	return result
}

/** qt 第 3 段是带后缀的代码（.INX / XLK.AM / SMH.OQ），K 线接口要用 us + 它 */
export function parseTencentUsKlineCode(text: string, code: string): string | null {
	const m = text.match(new RegExp(`v_${code}="([^"]*)"`))
	const symbol = m?.[1].split('~')[2]?.trim()
	return symbol ? `us${symbol}` : null
}

const usKlineCodeCache = new Map<string, string>()

export async function resolveTencentUsKlineCode(code: string): Promise<string> {
	const hit = usKlineCodeCache.get(code)
	if (hit) return hit
	const text = await fetchText(`https://qt.gtimg.cn/q=${encodeURIComponent(code)}`, {
		encoding: 'gbk',
		headers: TENCENT_HEADERS,
	})
	const resolved = parseTencentUsKlineCode(text, code)
	if (!resolved) throw new Error(`tencent qt ${code}: no symbol`)
	usKlineCodeCache.set(code, resolved)
	return resolved
}

// ───────────────────────── Naver ─────────────────────────

interface NaverPricePoint {
	localDateTime?: string
	currentPrice?: number | string
	accumulatedTradingVolume?: number | string
}

interface NaverPricesByPeriodResponse {
	isSuccess?: boolean
	result?: {
		lastClosePrice?: number | string
		zoneId?: string
		priceInfos?: NaverPricePoint[]
	}
}

const naverPoints = (list: NaverPricePoint[] | undefined, timeZone: string): MinutePoint[] =>
	normalizePoints(
		(list || []).flatMap((p) => {
			const ts = p.localDateTime ? parseLocalStamp(p.localDateTime, timeZone) : null
			const price = num(p.currentPrice)
			return ts != null && price != null
				? [[ts, price, num(p.accumulatedTradingVolume)] as MinutePoint]
				: []
		}),
	)

export function parseNaverPricesByPeriod(
	json: NaverPricesByPeriodResponse,
	timeZone: string,
	delayMinutes: number,
): RawTrend {
	const r = json.result
	return {
		name: null,
		prevClose: num(r?.lastClosePrice),
		// 盘前 priceInfos 为空（lastPriceInfos 是上一交易日的残缺数据，不用）；量是当日累计
		points: cumulativeToDelta(naverPoints(r?.priceInfos, timeZone)),
		delayMinutes,
		source: 'Naver 证券分时',
	}
}

/** 日本：.N225 / .TOPX（index）、1617.T（item） */
export async function fetchNaverWorldTrend(
	code: string,
	type: 'index' | 'item',
	timeZone: string,
	delayMinutes: number,
): Promise<RawTrend> {
	const url = `https://m.stock.naver.com/front-api/chart/pricesByPeriod?category=major&chartInfoType=${type}&scriptChartType=day&reutersCode=${encodeURIComponent(code)}`
	const json = await fetchJson<NaverPricesByPeriodResponse>(url, {
		headers: NAVER_HEADERS,
		retries: 1,
	})
	if (!json.isSuccess || !json.result) throw new Error(`naver chart ${code}: failed`)
	return parseNaverPricesByPeriod(json, timeZone, delayMinutes)
}

/** 韩国指数分钟线：量是每分钟量（不是累计） */
export function parseNaverDomesticMinute(json: NaverPricePoint[]): RawTrend {
	return {
		name: null,
		prevClose: null,
		points: naverPoints(Array.isArray(json) ? json : [], 'Asia/Seoul'),
		delayMinutes: 0,
		source: 'Naver 证券分时',
	}
}

/** 韩国指数：KOSPI / KOSDAQ / KPI200（实时，昨收由调用方从指数报价补）；带起止时间可取多日 */
export async function fetchNaverDomesticIndexMinute(
	code: string,
	range?: { start: string; end: string },
): Promise<RawTrend> {
	const query = range ? `?startDateTime=${range.start}&endDateTime=${range.end}` : ''
	const json = await fetchJson<NaverPricePoint[]>(
		`https://api.stock.naver.com/chart/domestic/index/${encodeURIComponent(code)}/minute${query}`,
		{ headers: NAVER_HEADERS, retries: 1 },
	)
	return parseNaverDomesticMinute(json)
}

/** 韩国指数近 n 个交易日分时（多取几天，前一天最后一笔作为次日昨收） */
export async function fetchNaverDomesticIndexDays(code: string, n: number): Promise<RawMultiDay> {
	const now = Date.now()
	const today = localParts(now, 'Asia/Seoul').dateKey
	const from = localParts(now - (n * 2 + 6) * 86_400_000, 'Asia/Seoul').dateKey
	const raw = await fetchNaverDomesticIndexMinute(code, {
		start: `${yyyymmdd(from)}000000`,
		end: `${yyyymmdd(today)}235959`,
	})
	const days = chainPrevClose(groupByDay(raw.points, 'Asia/Seoul'), n)
	if (days.length === 0) throw new Error(`naver minute days ${code}: empty`)
	return { name: null, days, delayMinutes: 0, source: 'Naver 证券分时' }
}

interface NaverCandleRow {
	localDate?: string
	openPrice?: number | string
	highPrice?: number | string
	lowPrice?: number | string
	closePrice?: number | string
	accumulatedTradingVolume?: number | string
}

export function parseNaverCandles(json: NaverCandleRow[]): Candle[] {
	const candles: Candle[] = []
	for (const r of Array.isArray(json) ? json : []) {
		const nums = [r.openPrice, r.highPrice, r.lowPrice, r.closePrice].map(num)
		if (!r.localDate || nums.some((x) => x == null)) continue
		candles.push([
			dashDate(r.localDate),
			nums[0],
			nums[1],
			nums[2],
			nums[3],
			num(r.accumulatedTradingVolume),
		] as Candle)
	}
	return normalizeCandles(candles)
}

/** 回看天数：日K 约 1.5 年，周K 5 年，月K 15 年 */
const NAVER_LOOKBACK_DAYS: Record<KlinePeriod, number> = { day: 540, week: 1830, month: 5480 }

/** 日韩 K 线：path 形如 domestic/index/KOSPI、foreign/index/.N225、foreign/item/1617.T */
export async function fetchNaverCandles(
	path: string,
	period: KlinePeriod,
	timeZone: string,
): Promise<RawCandles> {
	const now = Date.now()
	const end = yyyymmdd(localParts(now, timeZone).dateKey)
	const start = yyyymmdd(
		localParts(now - NAVER_LOOKBACK_DAYS[period] * 86_400_000, timeZone).dateKey,
	)
	const json = await fetchJson<NaverCandleRow[]>(
		`https://api.stock.naver.com/chart/${path}/${period}?startDateTime=${start}000000&endDateTime=${end}235959`,
		{ headers: NAVER_HEADERS, retries: 1 },
	)
	const candles = parseNaverCandles(json)
	if (candles.length < 2) throw new Error(`naver candles ${path}: empty`)
	return { name: null, candles, source: 'Naver 证券K线' }
}

// ───────────────────────── 东财（兜底 / 恒生行业） ─────────────────────────

/**
 * 东财 push2his 全局限流（整个进程共享，分时和 K 线一起算）：实测同 IP 秒级连发十几次就会被 Empty reply 封，
 * 而且会连带 push2 ulist（指数 / 恒生行业报价）一起封，所以宁可让走势暂不可用也不能撞限频。
 */
const EM_TRENDS_LIMIT = 6
const EM_TRENDS_WINDOW_MS = 60_000
const emTrendCalls: number[] = []

export function takeEastmoneyTrendSlot(now = Date.now()): boolean {
	while (emTrendCalls.length && now - emTrendCalls[0] >= EM_TRENDS_WINDOW_MS) emTrendCalls.shift()
	if (emTrendCalls.length >= EM_TRENDS_LIMIT) return false
	emTrendCalls.push(now)
	return true
}

/** 仅测试用 */
export function __resetEastmoneyTrendSlots() {
	emTrendCalls.length = 0
}

const EM_BUSY = '东财走势请求过于频繁，稍后再试'

interface EmTrendsResponse {
	data?: { name?: string; preClose?: number; trends?: string[] } | null
}

/** "2026-10-06 15:54,开,收(现价),高,低,量,…"，时间为北京时间；量为每分钟量 */
function emTrendPoints(lines: string[] | undefined): MinutePoint[] {
	const points: MinutePoint[] = []
	for (const line of lines || []) {
		const [time, , close, , , vol] = line.split(',')
		const ts = parseLocalStamp(time || '', 'Asia/Shanghai')
		const price = num(close)
		if (ts != null && price != null) points.push([ts, price, num(vol)])
	}
	return normalizePoints(points)
}

export function parseEastmoneyTrends(json: EmTrendsResponse): RawTrend {
	const d = json.data
	return {
		name: d?.name || null,
		prevClose: num(d?.preClose),
		points: emTrendPoints(d?.trends),
		delayMinutes: 0,
		source: '东方财富分时',
	}
}

/**
 * 多日：按标的当地日期分组，次日昨收用前一天最后一笔。
 * 线上实测 ndays=5 时 preClose/prePrice 都是「最新一天」的昨收，不是首日的，所以首日昨收留空（前端以首笔为基准）
 */
export function parseEastmoneyMultiDay(json: EmTrendsResponse, timeZone: string, n: number) {
	const d = json.data
	const days = groupByDay(emTrendPoints(d?.trends), timeZone)
	return {
		name: d?.name || null,
		days: chainPrevClose(days, n),
		delayMinutes: 0,
		source: '东方财富五日分时',
	} satisfies RawMultiDay
}

const emTrendsUrl = (secid: string, ndays: number) =>
	`https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56&iscr=0&ndays=${ndays}`

export async function fetchEastmoneyTrends(secid: string): Promise<RawTrend> {
	if (!takeEastmoneyTrendSlot()) throw new Error(EM_BUSY)
	const trend = parseEastmoneyTrends(
		await fetchJson<EmTrendsResponse>(emTrendsUrl(secid, 1), { headers: EM_HEADERS }),
	)
	if (trend.points.length === 0) throw new Error(`eastmoney trends ${secid}: empty`)
	return trend
}

export async function fetchEastmoneyFiveDay(secid: string, timeZone: string): Promise<RawMultiDay> {
	if (!takeEastmoneyTrendSlot()) throw new Error(EM_BUSY)
	const result = parseEastmoneyMultiDay(
		await fetchJson<EmTrendsResponse>(emTrendsUrl(secid, 5), { headers: EM_HEADERS }),
		timeZone,
		5,
	)
	if (result.days.length === 0) throw new Error(`eastmoney 5day ${secid}: empty`)
	return result
}

interface EmKlineResponse {
	data?: { name?: string; klines?: string[] } | null
}

/** "2026-10-06,开,收,高,低,量,额" */
export function parseEastmoneyKline(json: EmKlineResponse): RawCandles {
	const candles: Candle[] = []
	for (const line of json.data?.klines || []) {
		const [date, o, c, h, l, v] = line.split(',')
		const nums = [o, h, l, c].map(num)
		if (!date || nums.some((x) => x == null)) continue
		candles.push([date, nums[0], nums[1], nums[2], nums[3], num(v)] as Candle)
	}
	return {
		name: json.data?.name || null,
		candles: normalizeCandles(candles),
		source: '东方财富K线',
	}
}

const EM_KLT: Record<KlinePeriod, number> = { day: 101, week: 102, month: 103 }

export async function fetchEastmoneyKline(
	secid: string,
	period: KlinePeriod,
	count: number,
): Promise<RawCandles> {
	if (!takeEastmoneyTrendSlot()) throw new Error(EM_BUSY)
	const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=${EM_KLT[period]}&fqt=1&end=20500101&lmt=${count}`
	const result = parseEastmoneyKline(await fetchJson<EmKlineResponse>(url, { headers: EM_HEADERS }))
	if (result.candles.length < 2) throw new Error(`eastmoney kline ${secid}: empty`)
	return result
}
