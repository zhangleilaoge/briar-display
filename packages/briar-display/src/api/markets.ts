import type {
	ApiResponse,
	ChartPeriod,
	ChartTarget,
	MarketChartResponse,
	MarketId,
	MarketIndexTrendsResponse,
	MarketOverviewResponse,
	MarketSectorsResponse,
	SectorKind,
} from '@briar/shared'
import { apiClient } from './request'

/** 五个市场的大盘指数 + 交易状态（后端代理 + 短缓存） */
export const getMarketOverview = async () => {
	const response = await apiClient.get<ApiResponse<MarketOverviewResponse>>('/markets/overview', {
		timeout: 20_000,
	})
	return response.data
}

/** 某市场板块实时表现；kind=industry|concept，level 仅 A股行业（1 一级 / 2 二级） */
export const getMarketSectors = async (market: MarketId, kind: SectorKind, level?: string) => {
	const response = await apiClient.get<ApiResponse<MarketSectorsResponse>>(
		`/markets/${market}/sectors`,
		{ params: { kind, ...(level ? { level } : {}) }, timeout: 20_000 },
	)
	return response.data
}

/** 某市场大盘指数的当日分时 */
export const getMarketIndexTrends = async (market: MarketId) => {
	const response = await apiClient.get<ApiResponse<MarketIndexTrendsResponse>>(
		`/markets/${market}/index-trends`,
		{ timeout: 20_000 },
	)
	return response.data
}

/** 走势面板：指数 / 板块的分时、五日、日K、周K、月K（没有数据源的周期 available=false） */
export const getMarketChart = async (
	market: MarketId,
	target: ChartTarget,
	code: string,
	period: ChartPeriod,
) => {
	const response = await apiClient.get<ApiResponse<MarketChartResponse>>(
		`/markets/${market}/chart`,
		{
			params: { target, code, period },
			timeout: 20_000,
		},
	)
	return response.data
}
