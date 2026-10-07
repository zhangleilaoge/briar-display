/**
 * 恐贪指数服务：复用走势面板的日 K（getChart period=day，同一份 chart: 缓存），
 * 结果再按标的缓存 FEAR_GREED_TTL_MS（全局共享 + 单飞），批量接口逐个取缓存。
 */
import type {
	Candle,
	ChartTarget,
	FearGreedBatchResponse,
	FearGreedBoardResponse,
	FearGreedResult,
	MarketId,
	SectorItem,
	StockRef,
} from '@briar/shared'
import { fearGreedBand } from '@briar/shared'
import { cachedLoad } from './cache'
import { computeFearGreed } from './fearGreed'
import { getSectors } from './marketService'
import { getSessionStatus } from './session'
import { KLINE_TTL_MS, getChart } from './trendService'
import { fetchTencentKline } from './trendSources'

/** 恐贪按日 K 计算，盘中变化慢：8 分钟（需求 5–10 分钟） */
export const FEAR_GREED_TTL_MS = 8 * 60_000
export const FEAR_GREED_POLL_MS = 5 * 60_000
const CONCURRENCY = 6

/** 看板指数：A股主要指数 + 港股恒指 / 恒生科技（腾讯日 K 代码） */
export const FG_BOARD_INDICES: {
	market: MarketId
	code: string
	name: string
	inCatalog: boolean
}[] = [
	{ market: 'cn', code: 'sh000001', name: '上证指数', inCatalog: true },
	{ market: 'cn', code: 'sz399001', name: '深证成指', inCatalog: true },
	{ market: 'cn', code: 'sz399006', name: '创业板指', inCatalog: true },
	{ market: 'cn', code: 'sh000688', name: '科创50', inCatalog: true },
	{ market: 'cn', code: 'sh000300', name: '沪深300', inCatalog: false },
	{ market: 'cn', code: 'sh000016', name: '上证50', inCatalog: false },
	{ market: 'cn', code: 'sh000905', name: '中证500', inCatalog: false },
	{ market: 'hk', code: 'hkHSI', name: '恒生指数', inCatalog: true },
	{ market: 'hk', code: 'hkHSTECH', name: '恒生科技', inCatalog: true },
]

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** 有限并发 map（避免一次性几十个上游请求） */
export async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const out = new Array<R>(items.length)
	let next = 0
	const worker = async () => {
		while (next < items.length) {
			const i = next++
			out[i] = await fn(items[i])
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
	return out
}

const isIntraday = (market: MarketId) => {
	const s = getSessionStatus(market, Date.now())
	return s === 'open' || s === 'break'
}

interface Loaded {
	result: FearGreedResult
	stale: boolean
	fetchedAt: number
}

async function loadOne(
	market: MarketId,
	target: ChartTarget,
	code: string,
	name: string,
	candlesLoader: () => Promise<{ name: string; candles: Candle[] }>,
	flow?: SectorItem | null,
): Promise<Loaded> {
	try {
		const res = await cachedLoad(
			`feargreed:${market}:${target}:${code}`,
			FEAR_GREED_TTL_MS,
			async () => {
				const { name: srcName, candles } = await candlesLoader()
				const fg = computeFearGreed({
					candles,
					partialLast: isIntraday(market),
					flow: flow ? { netInflow: flow.netInflow, amount: flow.amount } : null,
				})
				return {
					market,
					target,
					code,
					name: name || srcName || code,
					score: fg.score,
					band: fearGreedBand(fg.score),
					components: fg.components,
					asOf: fg.asOf,
					candles: fg.candles,
					...(fg.score == null ? { reason: '日 K 数据不足，无法计算' } : {}),
				} satisfies FearGreedResult
			},
		)
		return { result: res.value, stale: res.stale, fetchedAt: res.fetchedAt }
	} catch (err) {
		return {
			result: {
				market,
				target,
				code,
				name: name || code,
				score: null,
				band: null,
				components: [],
				asOf: null,
				candles: 0,
				reason: `日 K 暂不可用：${errorMessage(err).slice(0, 80)}`,
			},
			stale: true,
			fetchedAt: Date.now(),
		}
	}
}

/** 走势面板的日 K（同一份 chart:{market}:{target}:{code}:day 缓存） */
async function chartCandles(market: MarketId, target: ChartTarget, code: string) {
	const chart = await getChart(market, target, code, 'day')
	if (!chart.available || chart.candles.length === 0) throw new Error(chart.reason || '无日 K')
	return { name: chart.name, candles: chart.candles }
}

function meta(list: Loaded[]) {
	return {
		fetchedAt: list.length ? Math.min(...list.map((l) => l.fetchedAt)) : Date.now(),
		stale: list.some((l) => l.stale),
	}
}

/** 自选股批量恐贪（refs 已校验） */
export async function getFearGreedBatch(
	refs: Pick<StockRef, 'market' | 'code'>[],
): Promise<FearGreedBatchResponse> {
	const loaded = await mapLimit(refs, CONCURRENCY, (r) =>
		loadOne(r.market, 'stock', r.code, '', () => chartCandles(r.market, 'stock', r.code)),
	)
	return { items: loaded.map((l) => l.result), pollMs: FEAR_GREED_POLL_MS, ...meta(loaded) }
}

/** 看板：主要指数 + 申万一级行业（只在腾讯 pt 板块时算，东财兜底的 BK 走势受限流，不算） */
export async function getFearGreedBoard(): Promise<FearGreedBoardResponse> {
	const res = await cachedLoad('feargreed:board', FEAR_GREED_TTL_MS, async () => {
		const indices = await mapLimit(FG_BOARD_INDICES, CONCURRENCY, (d) =>
			loadOne(d.market, 'index', d.code, d.name, () =>
				d.inCatalog
					? chartCandles(d.market, 'index', d.code)
					: // 不在大盘卡片目录里的指数（沪深300 等）直接取腾讯日 K，同样走全局缓存
						cachedLoad(
							`kline:day:${d.market}:${d.code}`,
							KLINE_TTL_MS[getSessionStatus(d.market, Date.now())],
							() => fetchTencentKline(d.code, 'day', 320),
						).then((r) => ({ name: d.name, candles: r.value.candles })),
			),
		)
		let sectors: Loaded[] = []
		let sectorSource = ''
		try {
			const list = await getSectors('cn', 'industry')
			const tencent = list.items.filter((s) => s.code.startsWith('pt'))
			sectorSource = tencent.length
				? `申万一级行业（${list.source}）`
				: '行业行情当前由东财兜底，为避免触发东财限流暂不计算行业恐贪'
			sectors = await mapLimit(tencent, CONCURRENCY, (s) =>
				loadOne('cn', 'sector', s.code, s.name, () => chartCandles('cn', 'sector', s.code), s),
			)
		} catch (err) {
			sectorSource = `行业列表暂不可用：${errorMessage(err).slice(0, 80)}`
		}
		const sorted = sectors.map((l) => l.result).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
		const all = [...indices, ...sectors]
		// 有分项失败（回旧值）就整体标 stale，但不抛错：看板部分可用也照常返回
		return { indices: indices.map((l) => l.result), sectors: sorted, sectorSource, ...meta(all) }
	})
	return { ...res.value, pollMs: FEAR_GREED_POLL_MS, stale: res.stale || res.value.stale }
}
