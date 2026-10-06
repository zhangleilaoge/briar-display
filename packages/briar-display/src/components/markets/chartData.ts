import type { Candle, MinuteDay } from '@briar/shared'

/**
 * 走势面板的纯数据处理（与图表库无关，便于测试）。
 * lightweight-charts 的时间轴按 UTC 显示，且按「根」等距排列：
 * - 把时间戳平移成「当地墙上时间当 UTC」，坐标轴就显示当地时间；
 * - 午休 / 隔夜没有数据点，自然被压缩掉；
 * - 当天尚未走完的分钟补空白点，横轴始终是完整交易时段。
 */

const offsetFormatters = new Map<string, Intl.DateTimeFormat>()

/** 某时刻在指定时区的 UTC 偏移（毫秒） */
export function tzOffsetMs(ts: number, timeZone: string): number {
	let fmt = offsetFormatters.get(timeZone)
	if (!fmt) {
		fmt = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		})
		offsetFormatters.set(timeZone, fmt)
	}
	const p: Record<string, string> = {}
	for (const part of fmt.formatToParts(new Date(ts))) p[part.type] = part.value
	const wall = Date.UTC(
		Number(p.year),
		Number(p.month) - 1,
		Number(p.day),
		Number(p.hour),
		Number(p.minute),
		Number(p.second),
	)
	return wall - Math.floor(ts / 1000) * 1000
}

export interface MinuteRow {
	/** 图表时间（秒，已平移为当地墙上时间） */
	time: number
	ts: number
	/** 空白点（尚未开盘 / 未来分钟）为 undefined */
	price?: number
	vol?: number | null
	/** 相对上一分钟涨跌（成交量柱着色） */
	up?: boolean
	/** 当天昨收（算当日涨跌幅） */
	prevClose: number | null
	date: string
}

const MINUTE = 60_000

/**
 * 多日分时 → 等距分钟行：时段内缺的分钟用上一笔价格补（东证 ETF 成交稀疏），
 * 最后一天收盘前的未来分钟补空白（横轴占满交易时段）。
 */
export function buildMinuteRows(days: MinuteDay[], timeZone: string): MinuteRow[] {
	const rows: MinuteRow[] = []
	let lastTime = Number.NEGATIVE_INFINITY
	let prevPrice: number | null = null
	days.forEach((day, dayIndex) => {
		const isLastDay = dayIndex === days.length - 1
		const byTs = new Map(day.points.map((p) => [p[0], p] as const))
		const stamps = new Set<number>(day.points.map((p) => p[0]))
		for (const [start, end] of day.sessions) {
			for (let t = start; t <= end; t += MINUTE) stamps.add(t)
		}
		const firstTs = day.points[0]?.[0] ?? Number.POSITIVE_INFINITY
		const lastTs = day.points[day.points.length - 1]?.[0] ?? Number.NEGATIVE_INFINITY
		let dayPrice: number | null = null
		for (const ts of [...stamps].sort((a, b) => a - b)) {
			const time = Math.floor((ts + tzOffsetMs(ts, timeZone)) / 1000)
			if (time <= lastTime) continue
			const base = { time, ts, prevClose: day.prevClose, date: day.date }
			const point = byTs.get(ts)
			if (ts < firstTs || ts > lastTs) {
				// 开盘前的空档跳过；只有最后一天的未来分钟补空白
				if (ts > lastTs && isLastDay) {
					rows.push(base)
					lastTime = time
				}
				continue
			}
			const price: number | null = point ? point[1] : dayPrice
			if (price == null) continue
			const ref = dayPrice ?? prevPrice ?? day.prevClose
			rows.push({ ...base, price, vol: point ? point[2] : 0, up: ref == null || price >= ref })
			dayPrice = price
			lastTime = time
		}
		if (dayPrice != null) prevPrice = dayPrice
	})
	return rows
}

/** 简单移动平均；不足 n 根为 null */
export function movingAverage(candles: Candle[], n: number): (number | null)[] {
	const out: (number | null)[] = []
	let sum = 0
	candles.forEach((c, i) => {
		sum += c[4]
		if (i >= n) sum -= candles[i - n][4]
		out.push(i >= n - 1 ? sum / n : null)
	})
	return out
}

/** 成交量：万 / 亿 */
export function formatVolume(value: number | null | undefined): string {
	if (value == null) return '--'
	if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
	if (value >= 1e4) return `${(value / 1e4).toFixed(value >= 1e6 ? 0 : 1)}万`
	return value.toFixed(0)
}

/** 平移后的秒 → "MM-DD" / "HH:MM"（UTC 读出来就是当地墙上时间） */
export function shiftedLabel(time: number, kind: 'date' | 'time' | 'datetime'): string {
	const d = new Date(time * 1000)
	const pad = (n: number) => String(n).padStart(2, '0')
	const date = `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
	const hm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
	return kind === 'date' ? date : kind === 'time' ? hm : `${date} ${hm}`
}
