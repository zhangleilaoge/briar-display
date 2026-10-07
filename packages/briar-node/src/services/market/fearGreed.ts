/**
 * 恐贪指数（0 = 极度恐惧，100 = 极度贪婪）—— 纯函数，输入日 K（前复权），不碰网络。
 *
 * 每个分项先归一化到 0–100（越高越贪婪），综合分 = 有效分项的等权平均。
 * 公式与 docs/global-sectors.md「恐贪指数」一节一一对应，改这里要同步改文档。
 */
import type { Candle, FearGreedComponent, FearGreedComponentKey } from '@briar/shared'

export const FG_MIN_COMPONENTS = 4

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x))
/** x 在 [lo, hi] 线性映射到 0–100，越界截断 */
export const linearScore = (x: number, lo: number, hi: number) =>
	clamp(((x - lo) / (hi - lo)) * 100)
const round1 = (x: number) => Math.round(x * 10) / 10
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function stdev(xs: number[]) {
	const m = mean(xs)
	return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

/** Wilder RSI：首个均值用简单平均，之后 avg = (avg·(n−1) + 当日) / n */
export function rsi(closes: number[], n = 14): number | null {
	if (closes.length < n + 1) return null
	let gain = 0
	let loss = 0
	for (let i = 1; i <= n; i++) {
		const d = closes[i] - closes[i - 1]
		if (d > 0) gain += d
		else loss -= d
	}
	gain /= n
	loss /= n
	for (let i = n + 1; i < closes.length; i++) {
		const d = closes[i] - closes[i - 1]
		gain = (gain * (n - 1) + Math.max(d, 0)) / n
		loss = (loss * (n - 1) + Math.max(-d, 0)) / n
	}
	if (gain === 0 && loss === 0) return 50
	if (loss === 0) return 100
	return 100 - 100 / (1 + gain / loss)
}

/** 第 end 根（含）往前 n 根日收益（对数）的标准差 */
function volatilityAt(closes: number[], end: number, n: number): number | null {
	if (end - n < 0) return null
	const rets: number[] = []
	for (let i = end - n + 1; i <= end; i++) rets.push(Math.log(closes[i] / closes[i - 1]))
	return stdev(rets)
}

/** 当前值在历史里的百分位（0–1）：严格小于的个数 + 一半的相等个数 */
export function percentileRank(history: number[], value: number): number {
	let below = 0
	let equal = 0
	for (const h of history) {
		if (h < value) below++
		else if (h === value) equal++
	}
	return (below + equal / 2) / history.length
}

export interface FearGreedInput {
	candles: Candle[]
	/** 最后一根是盘中未走完的 K 线（成交量分项会去掉它，价格分项照常用） */
	partialLast?: boolean
	/** 可选：主力净流入与成交额（同币种），仅 A股板块有 */
	flow?: { netInflow: number | null; amount: number | null } | null
}

export interface FearGreedScore {
	score: number | null
	components: FearGreedComponent[]
	asOf: string | null
	candles: number
}

const LABELS: Record<FearGreedComponentKey, string> = {
	ma125: '125 日均线偏离',
	ma20: '20 日均线偏离',
	rsi14: 'RSI(14)',
	momentum20: '20 日动量',
	volume: '量能（5 日 / 60 日均量）',
	volatility: '20 日波动率（历史分位）',
	range52w: '52 周区间位置',
	netInflow: '主力净流入 / 成交额',
}

export function computeFearGreed({
	candles: raw,
	partialLast = false,
	flow,
}: FearGreedInput): FearGreedScore {
	const candles = raw.filter((c) => Number.isFinite(c[4]) && c[4] > 0)
	const closes = candles.map((c) => c[4])
	const n = closes.length
	const last = closes[n - 1]
	const out: FearGreedComponent[] = []
	const push = (
		key: FearGreedComponentKey,
		value: number | null,
		score: number | null,
		detail: string,
	) =>
		out.push({
			key,
			label: LABELS[key],
			value: value == null ? null : Math.round(value * 10000) / 10000,
			score: score == null ? null : round1(score),
			detail,
		})

	// 1/2. 均线偏离：d = 收盘 / MA − 1；125 日 ±20%、20 日 ±10% 映射到 0–100
	for (const [key, len, band] of [
		['ma125', 125, 0.2],
		['ma20', 20, 0.1],
	] as const) {
		if (n >= len) {
			const ma = mean(closes.slice(n - len))
			const d = last / ma - 1
			push(
				key,
				d,
				linearScore(d, -band, band),
				`${d >= 0 ? '高于' : '低于'} ${len} 日均线 ${Math.abs(d * 100).toFixed(1)}%`,
			)
		} else push(key, null, null, `不足 ${len} 个交易日`)
	}

	// 3. RSI(14)：直接作为分数
	const r = rsi(closes, 14)
	push('rsi14', r, r, r == null ? '不足 15 个交易日' : `RSI ${r.toFixed(1)}`)

	// 4. 20 日动量：收盘 / 20 个交易日前收盘 − 1，±15% 映射到 0–100
	if (n >= 21) {
		const m = last / closes[n - 21] - 1
		push('momentum20', m, linearScore(m, -0.15, 0.15), `近 20 日 ${pct(m)}`)
	} else push('momentum20', null, null, '不足 21 个交易日')

	// 5. 量能：v = ln(近 5 日均量 / 近 60 日均量)，按近 5 日涨跌方向定号；
	//    放量上涨 → 贪婪，放量下跌 → 恐惧；|v| ≥ ln2（2 倍量）封顶
	const volCandles = partialLast ? candles.slice(0, -1) : candles
	const vols = volCandles.map((c) => c[5])
	const vn = vols.length
	if (vn >= 60 && vols.slice(vn - 60).every((v) => v != null && v >= 0) && closes.length >= 6) {
		const v60 = mean(vols.slice(vn - 60) as number[])
		const v5 = mean(vols.slice(vn - 5) as number[])
		const vc = volCandles.map((c) => c[4])
		const r5 = vc[vn - 1] / vc[vn - 6] - 1
		if (v60 > 0 && v5 > 0) {
			const v = Math.log(v5 / v60)
			const dir = r5 > 0 ? 1 : r5 < 0 ? -1 : 0
			const score = 50 + 50 * dir * clamp(v / Math.LN2, -1, 1)
			push(
				'volume',
				v5 / v60,
				score,
				`近 5 日均量为 60 日均量的 ${(v5 / v60).toFixed(2)} 倍，近 5 日 ${pct(r5)}`,
			)
		} else push('volume', null, null, '成交量为 0')
	} else push('volume', null, null, '无成交量数据或不足 60 个交易日')

	// 6. 波动率：当前 20 日日收益标准差在全部历史滚动值里的分位 p，分数 = 100 × (1 − p)（越波动越恐惧）
	const cur = volatilityAt(closes, n - 1, 20)
	const hist: number[] = []
	for (let i = 20; i < n; i++) {
		const v = volatilityAt(closes, i, 20)
		if (v != null) hist.push(v)
	}
	if (cur != null && hist.length >= 60) {
		const p = percentileRank(hist, cur)
		push(
			'volatility',
			p,
			100 * (1 - p),
			`年化 ${(cur * Math.sqrt(252) * 100).toFixed(1)}%，高于历史 ${(p * 100).toFixed(0)}% 的时间`,
		)
	} else push('volatility', null, null, '不足 80 个交易日')

	// 7. 52 周位置：(收盘 − 近 250 日最低) / (最高 − 最低)
	if (n >= 60) {
		const win = candles.slice(-250)
		const hi = Math.max(...win.map((c) => c[2]))
		const lo = Math.min(...win.map((c) => c[3]))
		const p = hi > lo ? (last - lo) / (hi - lo) : 0.5
		push(
			'range52w',
			p,
			clamp(p * 100),
			`位于近 ${win.length} 日区间的 ${(clamp(p * 100)).toFixed(0)}% 处`,
		)
	} else push('range52w', null, null, '不足 60 个交易日')

	// 8. A股板块：主力净流入 / 成交额，±10% 映射到 0–100（没有资金流的标的不出现这一项）
	if (flow) {
		if (flow.netInflow != null && flow.amount != null && flow.amount > 0) {
			const ratio = flow.netInflow / flow.amount
			push('netInflow', ratio, linearScore(ratio, -0.1, 0.1), `主力净流入占成交额 ${pct(ratio)}`)
		} else push('netInflow', null, null, '暂无资金流数据')
	}

	const valid = out.filter((c) => c.score != null).map((c) => c.score as number)
	return {
		score: valid.length >= FG_MIN_COMPONENTS ? round1(mean(valid)) : null,
		components: out,
		asOf: candles[n - 1]?.[0] ?? null,
		candles: n,
	}
}
