import type { ApiResponse, KimiUsageResponse } from '@briar/shared'
import { apiClient } from './request'

/** Kimi Code 用量（后端代理 + 60s 缓存；仅管理员） */
export const getKimiUsage = async () => {
	const response = await apiClient.get<ApiResponse<KimiUsageResponse>>('/kimi/usage', {
		timeout: 20_000,
	})
	return response.data
}
