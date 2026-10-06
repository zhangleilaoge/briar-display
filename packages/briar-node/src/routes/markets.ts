import type {
	ApiResponse,
	MarketChartResponse,
	MarketIndexTrendsResponse,
	MarketOverviewResponse,
	MarketSectorsResponse,
	SectorKind,
} from '@briar/shared'
import { HTTP_STATUS, isChartPeriod, isMarketId } from '@briar/shared'
import { Hono } from 'hono'
import { MarketInputError, getOverview, getSectors } from '../services/market/marketService'
import { getChart, getIndexTrends } from '../services/market/trendService'

/**
 * 全球板块行情代理（免登录 GET，见 config/routes.ts API_PUBLIC_PREFIXES）。
 * 上游请求全部走后端内存缓存（交易中 15s / 休市 5min），缓存 key 有限，
 * 客户端请求量再大也不会放大到上游；上游失败返回最近一次缓存 + stale 标记。
 */
const marketRoutes = new Hono()

/** GET /overview — 五个市场的大盘指数 + 交易状态 */
marketRoutes.get('/overview', async (c) => {
	const data = await getOverview()
	return c.json<ApiResponse<MarketOverviewResponse>>({ success: true, data })
})

/** GET /:market/sectors?kind=industry|concept&level=1|2 — 某市场的板块实时表现 */
marketRoutes.get('/:market/sectors', async (c) => {
	const market = c.req.param('market')
	if (!isMarketId(market)) {
		return c.json<ApiResponse>({ success: false, message: '不支持的市场' }, HTTP_STATUS.BAD_REQUEST)
	}
	const kindParam = c.req.query('kind') || 'industry'
	if (kindParam !== 'industry' && kindParam !== 'concept') {
		return c.json<ApiResponse>(
			{ success: false, message: '不支持的板块类别' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	try {
		const data = await getSectors(market, kindParam as SectorKind, c.req.query('level'))
		return c.json<ApiResponse<MarketSectorsResponse>>({ success: true, data })
	} catch (err) {
		if (err instanceof MarketInputError) {
			return c.json<ApiResponse>({ success: false, message: err.message }, HTTP_STATUS.BAD_REQUEST)
		}
		// 上游失败且没有任何缓存（通常是进程刚启动）才会走到这里
		console.error(`[markets] ${market} sectors failed:`, err)
		return c.json<ApiResponse>(
			{ success: false, message: '行情源暂时不可用，请稍后再试' },
			HTTP_STATUS.BAD_GATEWAY,
		)
	}
})

/** GET /:market/index-trends — 该市场大盘指数的当日分时 */
marketRoutes.get('/:market/index-trends', async (c) => {
	const market = c.req.param('market')
	if (!isMarketId(market)) {
		return c.json<ApiResponse>({ success: false, message: '不支持的市场' }, HTTP_STATUS.BAD_REQUEST)
	}
	try {
		const data = await getIndexTrends(market)
		return c.json<ApiResponse<MarketIndexTrendsResponse>>({ success: true, data })
	} catch (err) {
		console.error(`[markets] ${market} index trends failed:`, err)
		return c.json<ApiResponse>(
			{ success: false, message: '分时数据暂时不可用，请稍后再试' },
			HTTP_STATUS.BAD_GATEWAY,
		)
	}
})

/**
 * GET /:market/chart?target=index|sector&code=…&period=intraday|5day|day|week|month
 * 走势面板（分时 / 五日 / 日K / 周K / 月K）；没有数据源的周期返回 available=false 和原因
 */
marketRoutes.get('/:market/chart', async (c) => {
	const market = c.req.param('market')
	if (!isMarketId(market)) {
		return c.json<ApiResponse>({ success: false, message: '不支持的市场' }, HTTP_STATUS.BAD_REQUEST)
	}
	const target = c.req.query('target') || 'sector'
	const code = (c.req.query('code') || '').trim()
	const period = c.req.query('period') || 'intraday'
	if ((target !== 'index' && target !== 'sector') || !code || !isChartPeriod(period)) {
		return c.json<ApiResponse>({ success: false, message: '参数错误' }, HTTP_STATUS.BAD_REQUEST)
	}
	try {
		const data = await getChart(market, target, code, period)
		return c.json<ApiResponse<MarketChartResponse>>({ success: true, data })
	} catch (err) {
		if (err instanceof MarketInputError) {
			return c.json<ApiResponse>({ success: false, message: err.message }, HTTP_STATUS.BAD_REQUEST)
		}
		console.error(`[markets] ${market} chart ${target}:${code}:${period} failed:`, err)
		return c.json<ApiResponse>(
			{ success: false, message: '走势数据暂时不可用，请稍后再试' },
			HTTP_STATUS.BAD_GATEWAY,
		)
	}
})

export default marketRoutes
