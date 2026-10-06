import type {
	ApiResponse,
	MarketOverviewResponse,
	MarketSectorsResponse,
	SectorKind,
} from '@briar/shared'
import { HTTP_STATUS, isMarketId } from '@briar/shared'
import { Hono } from 'hono'
import { MarketInputError, getOverview, getSectors } from '../services/market/marketService'

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

export default marketRoutes
