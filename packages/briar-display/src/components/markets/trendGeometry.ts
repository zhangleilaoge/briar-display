import type { TrendPoint } from '@briar/shared'

/**
 * 分时图几何（纯函数，便于单测）：横轴按交易时段拼接（午休被压缩掉），纵轴以昨收为中心对称。
 */

/** 时间戳 → [0,1] 横向位置；午休期间的时间贴在上午收盘处，越界夹到两端 */
export function makeTimeScale(sessions: [number, number][], points: TrendPoint[] = []) {
	const ranges: [number, number][] =
		sessions.length > 0
			? sessions
			: points.length > 1
				? [[points[0][0], points[points.length - 1][0]]]
				: []
	const total = ranges.reduce((sum, [a, b]) => sum + (b - a), 0)
	return (ts: number): number => {
		if (total <= 0) return 0
		let acc = 0
		for (const [a, b] of ranges) {
			if (ts < a) return acc / total
			if (ts <= b) return (acc + ts - a) / total
			acc += b - a
		}
		return 1
	}
}

/** 各段之间（午休）的分界位置，用于画竖线和 11:30/13:00 标签 */
export function sessionBreaks(sessions: [number, number][]): number[] {
	const total = sessions.reduce((sum, [a, b]) => sum + (b - a), 0)
	if (total <= 0) return []
	const breaks: number[] = []
	let acc = 0
	for (let i = 0; i < sessions.length - 1; i++) {
		acc += sessions[i][1] - sessions[i][0]
		breaks.push(acc / total)
	}
	return breaks
}

/** 纵轴区间：有昨收时以昨收为中心对称（分时图惯例），至少 ±0.2% 免得平盘时放大噪声 */
export function priceDomain(points: TrendPoint[], prevClose: number | null): [number, number] {
	const prices = points.map((p) => p[1])
	if (prevClose != null && prevClose > 0) {
		const dev = Math.max(prevClose * 0.002, ...prices.map((p) => Math.abs(p - prevClose)))
		return [prevClose - dev * 1.08, prevClose + dev * 1.08]
	}
	if (prices.length === 0) return [0, 1]
	const lo = Math.min(...prices)
	const hi = Math.max(...prices)
	const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.002 || 1
	return [lo - pad, hi + pad]
}

/** SVG 折线 / 面积路径（坐标系 width × height，y 向下） */
export function buildPaths(
	points: TrendPoint[],
	xOf: (ts: number) => number,
	domain: [number, number],
	width: number,
	height: number,
): { line: string; area: string; coords: [number, number][] } {
	const [lo, hi] = domain
	const span = hi - lo || 1
	const coords = points.map(
		([ts, price]) => [xOf(ts) * width, (1 - (price - lo) / span) * height] as [number, number],
	)
	if (coords.length === 0) return { line: '', area: '', coords }
	const line = coords
		.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
		.join('')
	const area = `${line}L${coords[coords.length - 1][0].toFixed(2)},${height}L${coords[0][0].toFixed(2)},${height}Z`
	return { line, area, coords }
}

/** 二分找离横向位置 frac 最近的点 */
export function nearestIndex(fracs: number[], frac: number): number {
	if (fracs.length === 0) return -1
	let lo = 0
	let hi = fracs.length - 1
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if (fracs[mid] < frac) lo = mid + 1
		else hi = mid
	}
	if (lo > 0 && Math.abs(fracs[lo - 1] - frac) <= Math.abs(fracs[lo] - frac)) return lo - 1
	return lo
}
