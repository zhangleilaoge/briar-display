import type {
	ChartPeriod,
	ChartPeriodSupport,
	ChartTarget,
	MarketChartResponse,
	MarketId,
	MarketIndexTrendsResponse,
	MarketSessionStatus,
	MinuteDay,
	MinutePoint,
	TrendSeries,
} from '@briar/shared'
import { CHART_PERIODS, isStockCode } from '@briar/shared'
import { cachedLoad } from './cache'
import {
	CONCEPT_SECTORS,
	HK_INDUSTRY_INDICES,
	type IndexDef,
	JP_TOPIX17_ETFS,
	MARKET_INDICES,
	US_SECTOR_ETFS,
} from './catalog'
import { CURATED_NO_TREND } from './curated'
import { MarketInputError, getMarketOverview } from './marketService'
import {
	CACHE_TTL_MS,
	MARKET_SESSIONS,
	getSessionInfo,
	getSessionStatus,
	localParts,
	zonedTimeToTs,
} from './session'
import { fetchEastmoneyUlist } from './sources'
import { getStockQuote } from './stockService'
import {
	type KlinePeriod,
	type RawCandles,
	type RawMultiDay,
	type RawTrend,
	fetchEastmoneyFiveDay,
	fetchEastmoneyKline,
	fetchEastmoneyTrends,
	fetchNaverCandles,
	fetchNaverDomesticIndexDays,
	fetchNaverDomesticIndexMinute,
	fetchNaverWorldTrend,
	fetchTencentFiveDay,
	fetchTencentKline,
	fetchTencentMinute,
	fetchTencentUsMinute,
	resolveTencentUsKlineCode,
} from './trendSources'

/** 东证行情在 Naver 上延迟 15 分钟；腾讯美股 ETF / 个股报价也是延迟行情；腾讯港股个股按 15 分钟延迟计 */
const JP_DELAY_MINUTES = 15
const US_ETF_DELAY_MINUTES = 15
const HK_STOCK_DELAY_MINUTES = 15

/** K 线根数：日K 约一年，周K 约四年，月K 十年（MA20 需要多 19 根） */
const KLINE_COUNT: Record<KlinePeriod, number> = { day: 320, week: 220, month: 140 }

/** K 线缓存：交易中 60s，午休/盘前 5min，收盘后 30min（非交易时段不会变） */
export const KLINE_TTL_MS: Record<MarketSessionStatus, number> = {
	open: 60_000,
	break: 300_000,
	pre: 300_000,
	closed: 1_800_000,
}

/** 东财兜底源缓存至少 30s */
const EASTMONEY_MIN_TTL_MS = 30_000

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** 某交易日（当地日期）的连续竞价时段 → 时间戳区间，前端据此画横轴（午休断开压缩） */
export function sessionRanges(market: MarketId, dateKey: string): [number, number][] {
	const { timeZone, sessions } = MARKET_SESSIONS[market]
	const [y, mo, d] = dateKey.split('-').map(Number)
	const at = (minutes: number) =>
		zonedTimeToTs(timeZone, y, mo, d, Math.floor(minutes / 60), minutes % 60)
	return sessions.map(([start, end]) => [at(start), at(end)])
}

/** 卡片小图用的精简序列（只要价格） */
export function toSeries(market: MarketId, code: string, name: string, raw: RawTrend): TrendSeries {
	const { timeZone } = MARKET_SESSIONS[market]
	const last = raw.points[raw.points.length - 1]
	const tradeDate = last ? localParts(last[0], timeZone).dateKey : null
	return {
		code,
		name,
		prevClose: raw.prevClose,
		points: raw.points.map(([ts, price]) => [ts, price]),
		sessions: sessionRanges(market, tradeDate ?? localParts(Date.now(), timeZone).dateKey),
		tradeDate,
		delayMinutes: raw.delayMinutes,
		source: raw.source,
	}
}

/** 单日分时 → MinuteDay（无数据时按当地今天给时段，前端画空图） */
export function toMinuteDay(market: MarketId, raw: RawTrend): MinuteDay {
	const { timeZone } = MARKET_SESSIONS[market]
	const last = raw.points[raw.points.length - 1]
	const date = localParts(last ? last[0] : Date.now(), timeZone).dateKey
	return {
		date,
		prevClose: raw.prevClose,
		sessions: sessionRanges(market, date),
		points: raw.points,
	}
}

/** 主源失败才用兜底源（东财易封 IP，只做兜底） */
async function withFallback<T>(primary: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
	try {
		return await primary()
	} catch (err) {
		if (!fallback) throw err
		console.warn('[markets] 走势主源失败，改用兜底:', errorMessage(err))
		return fallback()
	}
}

const EMPTY_TREND: RawTrend = {
	name: null,
	prevClose: null,
	points: [],
	delayMinutes: 0,
	source: '',
}

// ───────────────────────── 大盘指数当日分时（卡片小图 + 面板分时共用一份缓存） ─────────────────────────

async function loadIndexTrend(
	market: MarketId,
	def: IndexDef,
	krPrevClose: (name: string) => number | null,
): Promise<RawTrend> {
	const { timeZone } = MARKET_SESSIONS[market]
	const em = def.em ? () => fetchEastmoneyTrends(def.em as string) : undefined
	switch (market) {
		case 'cn':
		case 'hk':
			if (!def.tencent) throw new Error(`${def.name}: 无分时代码`)
			return withFallback(() => fetchTencentMinute(def.tencent as string, timeZone), em)
		case 'us':
			if (!def.tencent) throw new Error(`${def.name}: 无分时代码`)
			return withFallback(() => fetchTencentUsMinute(def.tencent as string), em)
		case 'jp':
			if (!def.naver) {
				if (!em) throw new Error(`${def.name}: 无分时代码`)
				return em()
			}
			return withFallback(
				() => fetchNaverWorldTrend(def.naver?.code as string, 'index', timeZone, JP_DELAY_MINUTES),
				em,
			)
		case 'kr': {
			if (!def.naver) throw new Error(`${def.name}: 无分时代码`)
			const raw = await fetchNaverDomesticIndexMinute(def.naver.code)
			return { ...raw, prevClose: krPrevClose(def.name) }
		}
	}
}

/** 韩国分时不带昨收，从指数报价（price - change）补 */
async function krPrevCloseLookup(market: MarketId) {
	const overview = market === 'kr' ? await getMarketOverview(market).catch(() => null) : null
	return (name: string) => {
		const q = overview?.indices.find((i) => i.name === name)
		return q?.price != null && q.change != null ? Number((q.price - q.change).toFixed(4)) : null
	}
}

function loadIndexTrendsRaw(market: MarketId) {
	return cachedLoad(
		`trends:index:${market}`,
		CACHE_TTL_MS[getSessionStatus(market, Date.now())],
		async () => {
			const krPrevClose = await krPrevCloseLookup(market)
			const defs = MARKET_INDICES[market]
			const settled = await Promise.allSettled(
				defs.map((def) => loadIndexTrend(market, def, krPrevClose)),
			)
			if (settled.every((s) => s.status === 'rejected')) {
				throw new Error(
					settled.map((s) => (s.status === 'rejected' ? errorMessage(s.reason) : '')).join('; '),
				)
			}
			// 单个指数失败给空序列（前端显示暂无分时），不拖累其它指数
			return settled.map((s) => (s.status === 'fulfilled' ? s.value : EMPTY_TREND))
		},
	)
}

/** 指数在接口里的代码：优先东财 secid，其次腾讯 / Naver 代码 */
export const indexCode = (def: IndexDef) => def.em || def.tencent || def.naver?.code || def.name

export async function getIndexTrends(market: MarketId): Promise<MarketIndexTrendsResponse> {
	const { timeZone } = MARKET_SESSIONS[market]
	const result = await loadIndexTrendsRaw(market)
	const defs = MARKET_INDICES[market]
	const items = defs.map((def, i) => toSeries(market, indexCode(def), def.name, result.value[i]))
	const lastTs = Math.max(0, ...items.map((s) => s.points[s.points.length - 1]?.[0] ?? 0))
	return {
		market,
		timeZone,
		items,
		session: getSessionInfo(market, Date.now(), lastTs || null),
		fetchedAt: result.fetchedAt,
		stale: result.stale,
		...(result.error ? { error: result.error.slice(0, 300) } : {}),
	}
}

// ───────────────────────── 走势面板：标的 → 各周期加载方案 ─────────────────────────

interface ChartPlan {
	name: string
	/** 当日分时（指数直接读卡片那份缓存） */
	intraday?: () => Promise<RawTrend>
	fiveDay?: () => Promise<RawMultiDay>
	candles?: (period: KlinePeriod) => Promise<RawCandles>
	/** 主源是东财（易封 IP）：缓存至少 30s */
	eastmoney?: boolean
	/** K 线延迟（与当日行情一致） */
	delayMinutes: number
	/** 各周期不可用原因 */
	reasons: Partial<Record<ChartPeriod, string>>
}

const NO_JP_5DAY = '日本市场暂无多日分时数据源（Naver 只提供当日分时）'
const NO_KR_SECTOR = '该板块暂无走势数据（Naver 不提供韩国业种/主题的分时和K线）'

/** 腾讯美股：卡片代码 usINX / ETF usXLK → K 线要用 us.INX / usXLK.AM */
const tencentUsKline = (code: string) => async (period: KlinePeriod) =>
	fetchTencentKline(await resolveTencentUsKlineCode(code), period, KLINE_COUNT[period])

function planIndexChart(market: MarketId, code: string): ChartPlan {
	const defs = MARKET_INDICES[market]
	const index = defs.findIndex((d) =>
		[indexCode(d), d.tencent, d.naver?.code, d.name].includes(code),
	)
	if (index < 0) throw new MarketInputError('未知的指数代码')
	const def = defs[index]
	const { timeZone } = MARKET_SESSIONS[market]
	const intraday = async () => (await loadIndexTrendsRaw(market)).value[index]
	const tencent = def.tencent
	const naver = def.naver?.code
	switch (market) {
		case 'cn':
		case 'hk':
			return {
				name: def.name,
				intraday,
				fiveDay: tencent ? () => fetchTencentFiveDay(tencent, timeZone) : undefined,
				candles: tencent
					? (period) => fetchTencentKline(tencent, period, KLINE_COUNT[period])
					: undefined,
				delayMinutes: 0,
				reasons: {},
			}
		case 'us':
			return {
				name: def.name,
				intraday,
				fiveDay: tencent ? () => fetchTencentFiveDay(tencent, timeZone, true) : undefined,
				candles: tencent ? tencentUsKline(tencent) : undefined,
				delayMinutes: 0,
				reasons: {},
			}
		case 'jp':
			return {
				name: def.name,
				intraday,
				candles: naver
					? (period) => fetchNaverCandles(`foreign/index/${naver}`, period, timeZone)
					: undefined,
				delayMinutes: JP_DELAY_MINUTES,
				reasons: { '5day': NO_JP_5DAY },
			}
		case 'kr':
			return {
				name: def.name,
				intraday,
				fiveDay: naver ? () => fetchNaverDomesticIndexDays(naver, 5) : undefined,
				candles: naver
					? (period) => fetchNaverCandles(`domestic/index/${naver}`, period, timeZone)
					: undefined,
				delayMinutes: 0,
				reasons: {},
			}
	}
}

/** 东财美股 secid 要带交易所前缀（105/106/107），用 ulist 问一次后常驻内存 */
const usSecidCache = new Map<string, string>()

async function resolveUsSecid(code: string): Promise<string> {
	const hit = usSecidCache.get(code)
	if (hit) return hit
	const rows = await fetchEastmoneyUlist(['105', '106', '107'].map((m) => `${m}.${code}`))
	const row = rows.find((r) => r.code.toUpperCase() === code)
	if (!row) throw new Error(`eastmoney: ${code} not found`)
	usSecidCache.set(code, row.key)
	return row.key
}

const CN_TENCENT_BOARD = /^pt0[12][0-9A-Z]{3,12}$/
const CN_EM_BOARD = /^BK\d{4}$/
const KR_GROUP = /^[0-9A-Za-z]{1,12}$/

/** 东财全周期方案（恒生行业 / 东财兜底时的 A股 BK 板块） */
const eastmoneyPlan = (name: string, secid: string, timeZone: string): ChartPlan => ({
	name,
	intraday: () => fetchEastmoneyTrends(secid),
	fiveDay: () => fetchEastmoneyFiveDay(secid, timeZone),
	candles: (period) => fetchEastmoneyKline(secid, period, KLINE_COUNT[period]),
	eastmoney: true,
	delayMinutes: 0,
	reasons: {},
})

/** 板块代码 → 加载方案；代码不在白名单抛 400 */
function planSectorChart(market: MarketId, code: string): ChartPlan {
	const { timeZone } = MARKET_SESSIONS[market]
	switch (market) {
		case 'cn':
			// 腾讯板块代码（pt01 行业 / pt02 概念）分时、五日、K 线（newfqkline）都能直接查
			if (CN_TENCENT_BOARD.test(code)) {
				return {
					name: code,
					intraday: () => fetchTencentMinute(code, timeZone),
					fiveDay: () => fetchTencentFiveDay(code, timeZone),
					candles: (period) => fetchTencentKline(code, period, KLINE_COUNT[period]),
					delayMinutes: 0,
					reasons: {},
				}
			}
			if (CN_EM_BOARD.test(code)) return eastmoneyPlan(code, `90.${code}`, timeZone)
			break
		case 'hk': {
			// 腾讯/新浪/Naver 都没有恒生行业指数的走势，只能走东财（全局限流）
			const def = HK_INDUSTRY_INDICES.find((d) => d.code === code)
			if (def) return eastmoneyPlan(def.name, `124.${code}`, timeZone)
			// 概念板块：人工维护成分股组合，无对应指数走势
			const curated = CONCEPT_SECTORS.hk.find((d) => d.code === code)
			if (curated) {
				return {
					name: curated.name,
					delayMinutes: 15,
					reasons: Object.fromEntries(CHART_PERIODS.map((p) => [p, CURATED_NO_TREND])),
				}
			}
			break
		}
		case 'us': {
			const def = US_SECTOR_ETFS.find((d) => d.code === code)
			if (def) {
				return {
					name: def.name,
					intraday: () =>
						withFallback(
							() => fetchTencentUsMinute(`us${code}`),
							async () => fetchEastmoneyTrends(await resolveUsSecid(code)),
						),
					fiveDay: () => fetchTencentFiveDay(`us${code}`, timeZone, true),
					candles: tencentUsKline(`us${code}`),
					delayMinutes: US_ETF_DELAY_MINUTES,
					reasons: {},
				}
			}
			const curated = CONCEPT_SECTORS.us.find((d) => d.code === code)
			if (curated) {
				return {
					name: curated.name,
					delayMinutes: 15,
					reasons: Object.fromEntries(CHART_PERIODS.map((p) => [p, CURATED_NO_TREND])),
				}
			}
			break
		}
		case 'jp': {
			const def = JP_TOPIX17_ETFS.find((d) => d.code === code)
			if (def) {
				return {
					name: def.name,
					intraday: () => fetchNaverWorldTrend(`${code}.T`, 'item', timeZone, JP_DELAY_MINUTES),
					candles: (period) => fetchNaverCandles(`foreign/item/${code}.T`, period, timeZone),
					delayMinutes: JP_DELAY_MINUTES,
					reasons: { '5day': NO_JP_5DAY },
				}
			}
			break
		}
		case 'kr':
			if (KR_GROUP.test(code)) {
				const reasons = Object.fromEntries(CHART_PERIODS.map((p) => [p, NO_KR_SECTOR]))
				return { name: code, delayMinutes: 0, reasons }
			}
			break
	}
	throw new MarketInputError('未知的板块代码')
}

/** 只保留连续竞价时段内的分钟点（韩国个股分钟线含 NXT 盘前 08:00 / 盘后至 20:00） */
export function clipToSessions(market: MarketId, points: MinutePoint[]): MinutePoint[] {
	const { timeZone } = MARKET_SESSIONS[market]
	const rangesByDay = new Map<string, [number, number][]>()
	return points.filter(([ts]) => {
		const day = localParts(ts, timeZone).dateKey
		let ranges = rangesByDay.get(day)
		if (!ranges) {
			ranges = sessionRanges(market, day)
			rangesByDay.set(day, ranges)
		}
		return ranges.some(([start, end]) => ts >= start && ts <= end)
	})
}

/** 个股：A股 / 港股 / 美股走腾讯，日韩走 Naver（与指数同源） */
function planStockChart(market: MarketId, code: string): ChartPlan {
	if (!isStockCode(market, code)) throw new MarketInputError('股票代码格式不正确')
	const { timeZone } = MARKET_SESSIONS[market]
	switch (market) {
		case 'cn':
			return {
				name: code,
				intraday: () => fetchTencentMinute(code, timeZone),
				fiveDay: () => fetchTencentFiveDay(code, timeZone),
				candles: (period) => fetchTencentKline(code, period, KLINE_COUNT[period]),
				delayMinutes: 0,
				reasons: {},
			}
		case 'hk': {
			const t = `hk${code}`
			const delayed = <T extends { delayMinutes: number }>(p: Promise<T>) =>
				p.then((raw) => ({ ...raw, delayMinutes: HK_STOCK_DELAY_MINUTES }))
			return {
				name: code,
				intraday: () => delayed(fetchTencentMinute(t, timeZone)),
				fiveDay: () => delayed(fetchTencentFiveDay(t, timeZone)),
				candles: (period) => fetchTencentKline(t, period, KLINE_COUNT[period]),
				delayMinutes: HK_STOCK_DELAY_MINUTES,
				reasons: {},
			}
		}
		case 'us': {
			const t = `us${code}`
			return {
				name: code,
				intraday: () => fetchTencentUsMinute(t),
				fiveDay: () => fetchTencentFiveDay(t, timeZone, true),
				candles: tencentUsKline(t),
				delayMinutes: US_ETF_DELAY_MINUTES,
				reasons: {},
			}
		}
		case 'jp':
			return {
				name: code,
				intraday: () => fetchNaverWorldTrend(`${code}.T`, 'item', timeZone, JP_DELAY_MINUTES),
				candles: (period) => fetchNaverCandles(`foreign/item/${code}.T`, period, timeZone),
				delayMinutes: JP_DELAY_MINUTES,
				reasons: { '5day': NO_JP_5DAY },
			}
		case 'kr': {
			const clip = (points: MinutePoint[]) => clipToSessions('kr', points)
			return {
				name: code,
				intraday: async () => {
					// 分钟线不带昨收：从个股报价（同一份全局缓存）补
					const [raw, quote] = await Promise.all([
						fetchNaverDomesticIndexMinute(code, undefined, 'item'),
						getStockQuote('kr', code).catch(() => null),
					])
					return { ...raw, points: clip(raw.points), prevClose: quote?.quote.prevClose ?? null }
				},
				fiveDay: () => fetchNaverDomesticIndexDays(code, 5, 'item', clip),
				candles: (period) => fetchNaverCandles(`domestic/item/${code}`, period, timeZone),
				delayMinutes: 0,
				reasons: {},
			}
		}
	}
}

function periodSupport(plan: ChartPlan): ChartPeriodSupport[] {
	return CHART_PERIODS.map((period) => {
		const has =
			period === 'intraday' ? !!plan.intraday : period === '5day' ? !!plan.fiveDay : !!plan.candles
		return has
			? { period, available: true }
			: { period, available: false, reason: plan.reasons[period] || '该周期暂无数据源' }
	})
}

type ChartPayload = Pick<
	MarketChartResponse,
	'prevClose' | 'days' | 'candles' | 'delayMinutes' | 'source'
> & { name: string | null }

async function loadPeriod(market: MarketId, plan: ChartPlan, period: ChartPeriod) {
	if (period === 'intraday' && plan.intraday) {
		const raw = await plan.intraday()
		if (!raw.source) throw new Error('分时数据暂时不可用')
		return {
			name: raw.name,
			prevClose: raw.prevClose,
			days: [toMinuteDay(market, raw)],
			candles: [],
			delayMinutes: raw.delayMinutes,
			source: raw.source,
		} satisfies ChartPayload
	}
	if (period === '5day' && plan.fiveDay) {
		const raw = await plan.fiveDay()
		const days: MinuteDay[] = raw.days.map((d) => ({
			...d,
			sessions: sessionRanges(market, d.date),
		}))
		return {
			name: raw.name,
			prevClose: days[0]?.prevClose ?? null,
			days,
			candles: [],
			delayMinutes: raw.delayMinutes,
			source: raw.source,
		} satisfies ChartPayload
	}
	if (period !== 'intraday' && period !== '5day' && plan.candles) {
		const raw = await plan.candles(period)
		return {
			name: raw.name,
			prevClose: null,
			days: [],
			candles: raw.candles,
			delayMinutes: plan.delayMinutes,
			source: raw.source,
		} satisfies ChartPayload
	}
	return null
}

/** 走势面板数据：target=index|sector|stock，period=intraday|5day|day|week|month */
export async function getChart(
	market: MarketId,
	target: ChartTarget,
	code: string,
	period: ChartPeriod,
): Promise<MarketChartResponse> {
	const { timeZone } = MARKET_SESSIONS[market]
	const plan =
		target === 'index'
			? planIndexChart(market, code)
			: target === 'stock'
				? planStockChart(market, code)
				: planSectorChart(market, code)
	const periods = periodSupport(plan)
	const support = periods.find((p) => p.period === period)
	const now = Date.now()
	const base = { market, target, code, period, timeZone, periods }
	if (!support?.available) {
		return {
			...base,
			name: plan.name,
			available: false,
			reason: support?.reason,
			prevClose: null,
			days: [],
			candles: [],
			delayMinutes: plan.delayMinutes,
			source: '',
			session: getSessionInfo(market, now),
			fetchedAt: now,
			stale: false,
		}
	}
	const status = getSessionStatus(market, now)
	const isKline = period === 'day' || period === 'week' || period === 'month'
	let ttl = isKline ? KLINE_TTL_MS[status] : CACHE_TTL_MS[status]
	if (plan.eastmoney) ttl = Math.max(ttl, EASTMONEY_MIN_TTL_MS)
	const result = await cachedLoad(`chart:${market}:${target}:${code}:${period}`, ttl, async () => {
		const payload = await loadPeriod(market, plan, period)
		if (!payload) throw new Error('该周期暂无数据源')
		return payload
	})
	const { name, ...payload } = result.value
	const lastDay = payload.days[payload.days.length - 1]
	const lastTs = lastDay?.points[lastDay.points.length - 1]?.[0] ?? null
	return {
		...base,
		// 板块名以方案为准；A股板块方案里只有代码，用数据源返回的名称
		name: plan.name === code && name ? name : plan.name,
		available: true,
		...payload,
		session: getSessionInfo(market, now, lastTs),
		fetchedAt: result.fetchedAt,
		stale: result.stale,
		...(result.error ? { error: result.error.slice(0, 300) } : {}),
	}
}
