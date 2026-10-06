import type {
	ApiResponse,
	MarketChartResponse,
	MarketIndexTrendsResponse,
	MarketOverviewResponse,
	MarketSectorsResponse,
	SectorConstituentsResponse,
	SectorKind,
	StockQuoteResponse,
	StockQuotesResponse,
	StockSearchResponse,
	WatchlistItem,
} from '@briar/shared'
import { HTTP_STATUS, isChartPeriod, isMarketId } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { marketWatchlistDal } from '../dal/marketWatchlistDal'
import { authService } from '../services/authService'
import { MarketInputError, getOverview, getSectors } from '../services/market/marketService'
import {
	getConstituents,
	getStockQuote,
	getStockQuotes,
	searchStocks,
} from '../services/market/stockService'
import { getChart, getIndexTrends } from '../services/market/trendService'
import {
	normalizeStockRef,
	parseStockRefs,
	sanitizeWatchlistItems,
} from '../services/market/watchlist'

/**
 * 全球板块行情代理（免登录 GET，见 config/routes.ts API_PUBLIC_PREFIXES）。
 * 上游请求全部走后端进程内全局缓存（交易中默认 20s，可配 15–30s；休市 5min；K 线更长），LRU 有上限，
 * 客户端请求量再大也不会放大到上游；上游失败返回最近一次缓存 + stale 标记。
 */
const marketRoutes = new Hono()

const badRequest = (c: Context, message: string) =>
	c.json<ApiResponse>({ success: false, message }, HTTP_STATUS.BAD_REQUEST)

const upstreamError = (c: Context, message: string) =>
	c.json<ApiResponse>({ success: false, message }, HTTP_STATUS.BAD_GATEWAY)

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
 * GET /:market/chart?target=index|sector|stock&code=…&period=intraday|5day|day|week|month
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
	if (
		(target !== 'index' && target !== 'sector' && target !== 'stock') ||
		!code ||
		!isChartPeriod(period)
	) {
		return c.json<ApiResponse>({ success: false, message: '参数错误' }, HTTP_STATUS.BAD_REQUEST)
	}
	try {
		// 美股个股代码统一大写
		const data = await getChart(
			market,
			target,
			target === 'stock' && market === 'us' ? code.toUpperCase() : code,
			period,
		)
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

/**
 * GET /:market/constituents?code=板块代码&kind=industry|concept — 板块成分股
 * 没有成分股数据源的板块（恒生行业指数、美日行业 ETF）返回 available=false 和原因
 */
marketRoutes.get('/:market/constituents', async (c) => {
	const market = c.req.param('market')
	if (!isMarketId(market)) return badRequest(c, '不支持的市场')
	const code = (c.req.query('code') || '').trim()
	const kind = c.req.query('kind') || 'industry'
	if (!code || (kind !== 'industry' && kind !== 'concept')) return badRequest(c, '参数错误')
	try {
		const data = await getConstituents(market, code, kind as SectorKind)
		return c.json<ApiResponse<SectorConstituentsResponse>>({ success: true, data })
	} catch (err) {
		if (err instanceof MarketInputError) return badRequest(c, err.message)
		console.error(`[markets] ${market} constituents ${kind}:${code} failed:`, err)
		return upstreamError(c, '成分股数据暂时不可用，请稍后再试')
	}
})

/** GET /:market/stock?code=… — 个股报价（价格、涨跌幅、成交额、换手率、市值、PE 等） */
marketRoutes.get('/:market/stock', async (c) => {
	const market = c.req.param('market')
	if (!isMarketId(market)) return badRequest(c, '不支持的市场')
	const ref = normalizeStockRef(market, c.req.query('code') || '')
	if (!ref) return badRequest(c, '股票代码格式不正确')
	try {
		const data = await getStockQuote(market, ref.code)
		return c.json<ApiResponse<StockQuoteResponse>>({ success: true, data })
	} catch (err) {
		if (err instanceof MarketInputError) return badRequest(c, err.message)
		console.error(`[markets] ${market} stock ${ref.code} failed:`, err)
		return upstreamError(c, '个股行情暂时不可用，请稍后再试')
	}
})

/** GET /search?q=… — 跨市场搜索个股 / ETF（代码、名称、拼音首字母），后端缓存 10 分钟 */
marketRoutes.get('/search', async (c) => {
	const q = c.req.query('q') || ''
	if (!q.trim()) return badRequest(c, '请输入搜索关键词')
	try {
		const data = await searchStocks(q)
		return c.json<ApiResponse<StockSearchResponse>>({ success: true, data })
	} catch (err) {
		if (err instanceof MarketInputError) return badRequest(c, err.message)
		console.error('[markets] search failed:', err)
		return upstreamError(c, '搜索暂时不可用，请稍后再试')
	}
})

/** GET /quotes?items=cn:sh600519,us:AAPL,kr:005930 — 自选列表批量报价（最多 100 个） */
marketRoutes.get('/quotes', async (c) => {
	const refs = parseStockRefs(c.req.query('items'))
	if (refs.length === 0) return badRequest(c, '参数错误')
	try {
		const data = await getStockQuotes(refs)
		return c.json<ApiResponse<StockQuotesResponse>>({ success: true, data })
	} catch (err) {
		console.error('[markets] quotes failed:', err)
		return upstreamError(c, '行情源暂时不可用，请稍后再试')
	}
})

// ───────────────────────── 自选股（登录用户存服务端，访客存前端 localStorage） ─────────────────────────

/**
 * /api/markets/* 的 GET 免登录（跳过 authMiddleware），自选的 GET 自己识别登录态；
 * POST / DELETE 不在免登录名单里，已经过 authMiddleware（c.get('user')）
 */
async function resolveUserId(c: Context): Promise<string | null> {
	const existing = c.get('user') as { id: string } | undefined
	if (existing?.id) return existing.id
	const token =
		c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || getCookie(c, 'briar_token')
	if (!token) return null
	const auth = await authService.verifyLoginToken(token)
	return auth ? auth.user.id : null
}

const unauthorized = (c: Context) =>
	c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)

/** GET /watchlist — 当前用户的自选（需登录） */
marketRoutes.get('/watchlist', async (c) => {
	const userId = await resolveUserId(c)
	if (!userId) return unauthorized(c)
	const items = await marketWatchlistDal.list(userId)
	return c.json<ApiResponse<WatchlistItem[]>>({ success: true, data: items })
})

/** POST /watchlist — 加入自选：{ market, code, name } 或 { items: [...] }（访客自选登录后合并用），返回最新列表 */
marketRoutes.post('/watchlist', async (c) => {
	const userId = await resolveUserId(c)
	if (!userId) return unauthorized(c)
	const items = sanitizeWatchlistItems(await c.req.json().catch(() => null))
	if (items.length === 0) return badRequest(c, '参数错误')
	await marketWatchlistDal.add(userId, items)
	const list = await marketWatchlistDal.list(userId)
	return c.json<ApiResponse<WatchlistItem[]>>({ success: true, data: list })
})

/** DELETE /watchlist/:market/:code — 移出自选，返回最新列表 */
marketRoutes.delete('/watchlist/:market/:code', async (c) => {
	const userId = await resolveUserId(c)
	if (!userId) return unauthorized(c)
	const ref = normalizeStockRef(c.req.param('market'), c.req.param('code'))
	if (!ref) return badRequest(c, '参数错误')
	await marketWatchlistDal.remove(userId, ref.market, ref.code)
	const list = await marketWatchlistDal.list(userId)
	return c.json<ApiResponse<WatchlistItem[]>>({ success: true, data: list })
})

export default marketRoutes
