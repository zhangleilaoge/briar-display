import type { MarketId, MinuteDay, TrendSeries } from '@briar/shared'
import { MARKET_SESSIONS, localParts, zonedTimeToTs } from './session'
import type { RawTrend } from './trendSources'

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
