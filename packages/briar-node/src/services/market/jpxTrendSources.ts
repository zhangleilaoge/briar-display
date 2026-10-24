import type { Candle, MinutePoint } from '@briar/shared'
import { fetchJson } from './http'
import { localParts } from './session'
import { num } from './sources'
import {
	type KlinePeriod,
	type RawCandles,
	type RawTrend,
	normalizeCandles,
	normalizePoints,
	parseLocalStamp,
} from './trendSources'

const JPX_HEADERS = { Referer: 'https://quote.jpx.co.jp/' }
const JPX_TIMEOUT_MS = 25_000
const JPX_CANDLE_KEYS: Record<KlinePeriod, string> = {
	day: 'A_HISTDAYL',
	week: 'A_HISTWEEKL',
	month: 'A_HISTMONTHL',
}
const JPX_INTERVALS: Record<KlinePeriod, string> = { day: 'd', week: 'w', month: 'm' }

type JpxStatus = number | string
type JpxEntry = Record<string, unknown>

interface JpxResponse {
	section1?: {
		status?: JpxStatus
		data?: Record<string, JpxEntry | undefined>
	}
	status?: JpxStatus
}

const statusOk = (status: JpxStatus | undefined) => status === 0 || status === '0'

function getEntry(json: JpxResponse, qcode: string): JpxEntry {
	if (!statusOk(json.status) || !statusOk(json.section1?.status)) {
		throw new Error(`jpx ${qcode}: bad status`)
	}
	const entry = json.section1?.data?.[qcode]
	if (!entry) throw new Error(`jpx ${qcode}: missing entry`)
	return entry
}

function getRows(entry: JpxEntry, key: string, qcode: string): unknown[] {
	const rows = entry[key]
	if (!Array.isArray(rows) || rows.length === 0) throw new Error(`jpx ${qcode}: empty ${key}`)
	return rows
}

function slashDate(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const m = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
	if (!m) return null
	const [y, mo, d] = m.slice(1).map(Number)
	const date = new Date(Date.UTC(y, mo - 1, d))
	if (
		y < 1000 ||
		date.getUTCFullYear() !== y ||
		date.getUTCMonth() !== mo - 1 ||
		date.getUTCDate() !== d
	) {
		return null
	}
	return `${m[1]}-${m[2]}-${m[3]}`
}

function nameOf(entry: JpxEntry): string | null {
	return typeof entry.NAME === 'string' && entry.NAME.trim() ? entry.NAME : null
}

function parseCandle(row: unknown): Candle | null {
	if (!Array.isArray(row)) return null
	const date = slashDate(row[0])
	const values = [row[1], row[2], row[3], row[4]].map(num)
	if (!date || values.some((value) => value == null)) return null
	return [date, values[0], values[1], values[2], values[3], num(row[5])] as Candle
}

export function parseJpxIntraday(
	json: JpxResponse,
	qcode: string,
	timeZone = 'Asia/Tokyo',
): RawTrend {
	const entry = getEntry(json, qcode)
	const date = slashDate(entry.HISTMDATE1)
	if (!date) throw new Error(`jpx intraday ${qcode}: invalid HISTMDATE1`)
	const rows = getRows(entry, 'HISTMIN1', qcode)
	const points: MinutePoint[] = []
	for (const row of rows) {
		if (
			!Array.isArray(row) ||
			typeof row[0] !== 'string' ||
			!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row[0])
		) {
			continue
		}
		const ts = parseLocalStamp(`${date} ${row[0]}`, timeZone)
		const close = num(row[2])
		if (ts != null && close != null) points.push([ts, close, num(row[5])])
	}
	const normalized = normalizePoints(points)
	if (normalized.length === 0) throw new Error(`jpx intraday ${qcode}: no valid points`)
	return {
		name: nameOf(entry),
		prevClose: num(entry.PRP),
		points: normalized,
		delayMinutes: 0,
		source: 'JPX 官方指数分时',
	}
}

export function parseJpxCandles(
	json: JpxResponse,
	qcode: string,
	period: KlinePeriod,
	today: string,
): RawCandles {
	const entry = getEntry(json, qcode)
	const rows = getRows(entry, JPX_CANDLE_KEYS[period], qcode)
	const candles = rows.flatMap((row) => {
		const candle = parseCandle(row)
		return candle ? [candle] : []
	})
	if (period === 'day' && slashDate(entry.ZXD) === today) {
		const current = parseCandle([entry.ZXD, entry.DOP, entry.DHP, entry.DLP, entry.DPP, entry.DV])
		if (current) candles.push(current)
	}
	const normalized = normalizeCandles(candles)
	if (normalized.length === 0) throw new Error(`jpx candles ${qcode}: no valid ${period} rows`)
	return { name: nameOf(entry), candles: normalized, source: 'JPX 官方指数K线' }
}

const jpxUrl = (interval: string, qcode: string) =>
	`https://quote.jpx.co.jp/jpxhp/chartapi/jcgi/qjsonp.cgi?F=json/ja_idx_hist_${interval}&quote=${encodeURIComponent(qcode)}`

export async function fetchJpxIntraday(qcode: string, timeZone = 'Asia/Tokyo'): Promise<RawTrend> {
	const json = await fetchJson<JpxResponse>(jpxUrl('i', qcode), {
		headers: JPX_HEADERS,
		timeoutMs: JPX_TIMEOUT_MS,
	})
	return parseJpxIntraday(json, qcode, timeZone)
}

export async function fetchJpxCandles(qcode: string, period: KlinePeriod): Promise<RawCandles> {
	const json = await fetchJson<JpxResponse>(jpxUrl(JPX_INTERVALS[period], qcode), {
		headers: JPX_HEADERS,
		timeoutMs: JPX_TIMEOUT_MS,
	})
	const today = localParts(Date.now(), 'Asia/Tokyo').dateKey
	return parseJpxCandles(json, qcode, period, today)
}
