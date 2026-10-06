import type {
	ApiResponse,
	MarketId,
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
