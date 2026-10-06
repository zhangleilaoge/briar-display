import type { MarketId, MarketSessionInfo, MarketSessionStatus } from '@briar/shared'

/**
 * 各市场交易时段（当地时间，分钟数，含午休）。只按工作日 + 时段判断，
 * 节假日靠「最近行情日期 ≠ 当地今天」识别为休市（见 getSessionStatus）。
 */
interface SessionDef {
	timeZone: string
	sessions: [number, number][]
	text: string
}

const hm = (h: number, m = 0) => h * 60 + m

export const MARKET_SESSIONS: Record<MarketId, SessionDef> = {
	cn: {
		timeZone: 'Asia/Shanghai',
		sessions: [
			[hm(9, 30), hm(11, 30)],
			[hm(13), hm(15)],
		],
		text: '09:30–11:30 / 13:00–15:00',
	},
	// 港股 16:00 收盘后还有 10 分钟收市竞价
	hk: {
		timeZone: 'Asia/Hong_Kong',
		sessions: [
			[hm(9, 30), hm(12)],
			[hm(13), hm(16, 10)],
		],
		text: '09:30–12:00 / 13:00–16:10',
	},
	us: {
		timeZone: 'America/New_York',
		sessions: [[hm(9, 30), hm(16)]],
		text: '09:30–16:00（美东）',
	},
	// 东证 2024-11 起收盘延长到 15:30
	jp: {
		timeZone: 'Asia/Tokyo',
		sessions: [
			[hm(9), hm(11, 30)],
			[hm(12, 30), hm(15, 30)],
		],
		text: '09:00–11:30 / 12:30–15:30',
	},
	kr: { timeZone: 'Asia/Seoul', sessions: [[hm(9), hm(15, 30)]], text: '09:00–15:30' },
}

/** 前端轮询间隔：交易中 20s，午休/盘前 60s，休市 5min */
export const POLL_MS: Record<MarketSessionStatus, number> = {
	open: 20_000,
	break: 60_000,
	pre: 60_000,
	closed: 300_000,
}

/** 后端缓存 TTL：交易中 15s，午休/盘前 60s，休市 5min */
export const CACHE_TTL_MS: Record<MarketSessionStatus, number> = {
	open: 15_000,
	break: 60_000,
	pre: 60_000,
	closed: 300_000,
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const formatterCache = new Map<string, Intl.DateTimeFormat>()

/** 指定时区下的星期 / 当日分钟数 / 日期键 */
export function localParts(ts: number, timeZone: string) {
	let fmt = formatterCache.get(timeZone)
	if (!fmt) {
		fmt = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			weekday: 'short',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		})
		formatterCache.set(timeZone, fmt)
	}
	const parts: Record<string, string> = {}
	for (const p of fmt.formatToParts(new Date(ts))) parts[p.type] = p.value
	return {
		weekday: WEEKDAYS.indexOf(parts.weekday),
		minutes: Number(parts.hour) * 60 + Number(parts.minute),
		dateKey: `${parts.year}-${parts.month}-${parts.day}`,
	}
}

/** 开盘后多久才用「行情日期」校验节假日（延迟行情开盘头 15 分钟还是昨收，留足余量） */
const HOLIDAY_CHECK_GRACE_MIN = 30

/**
 * 交易状态。quoteTime 传最近一笔行情时间：时钟在交易时段内、但行情日期不是当地今天 → 节假日休市。
 */
export function getSessionStatus(
	market: MarketId,
	now: number,
	quoteTime: number | null = null,
): MarketSessionStatus {
	const def = MARKET_SESSIONS[market]
	const local = localParts(now, def.timeZone)
	if (local.weekday === 0 || local.weekday === 6) return 'closed'
	const first = def.sessions[0][0]
	const last = def.sessions[def.sessions.length - 1][1]
	const m = local.minutes
	if (m < first) return 'pre'
	if (m >= last) return 'closed'
	const inSession = def.sessions.some(([start, end]) => m >= start && m < end)
	const status: MarketSessionStatus = inSession ? 'open' : 'break'
	if (quoteTime != null && m >= first + HOLIDAY_CHECK_GRACE_MIN) {
		if (localParts(quoteTime, def.timeZone).dateKey !== local.dateKey) return 'closed'
	}
	return status
}

export function getSessionInfo(
	market: MarketId,
	now: number,
	quoteTime: number | null = null,
): MarketSessionInfo {
	const def = MARKET_SESSIONS[market]
	const status = getSessionStatus(market, now, quoteTime)
	return { status, timeZone: def.timeZone, sessionText: def.text, pollMs: POLL_MS[status] }
}

/** 把某时区的本地时间（年月日时分秒）换算成毫秒时间戳 */
export function zonedTimeToTs(
	timeZone: string,
	y: number,
	mo: number,
	d: number,
	h = 0,
	mi = 0,
	s = 0,
): number {
	const guess = Date.UTC(y, mo - 1, d, h, mi, s)
	// 用 guess 在目标时区的显示时间反推偏移（DST 边界附近误差 ≤ 1h，行情时间够用）
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
	const p: Record<string, string> = {}
	for (const part of fmt.formatToParts(new Date(guess))) p[part.type] = part.value
	const shown = Date.UTC(
		Number(p.year),
		Number(p.month) - 1,
		Number(p.day),
		Number(p.hour),
		Number(p.minute),
		Number(p.second),
	)
	return guess - (shown - guess)
}
