import type { ApiResponse, KimiUsageResponse } from '@briar/shared'
import { apiClient } from './request'

/** Kimi Code 用量（后端代理 + 60s 缓存；仅管理员；Key 存库） */
export const getKimiUsage = async () => {
	const response = await apiClient.get<ApiResponse<KimiUsageResponse>>('/kimi/usage', {
		timeout: 20_000,
	})
	return response.data
}

/** 保存 / 覆盖 API Key；响应只含脱敏 hint */
export const saveKimiApiKey = async (apiKey: string) => {
	const response = await apiClient.put<ApiResponse<{ hint: string }>>('/kimi/api-key', {
		apiKey,
	})
	return response.data
}

/** 软删除已存 Key */
export const clearKimiApiKey = async () => {
	const response = await apiClient.delete<ApiResponse>('/kimi/api-key')
	return response.data
}
