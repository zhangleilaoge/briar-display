import type { ApiResponse, MagnetParseResult } from '@briar/shared'
import { apiClient } from './request'

/** 查询 magnet/ed2k 链接信息（名称/大小/文件数/截图）；首解析较慢，放宽超时 */
export const parseMagnet = async (url: string) => {
	const response = await apiClient.post<ApiResponse<MagnetParseResult>>(
		'/magnet/parse',
		{ url },
		{ timeout: 90_000 },
	)
	return response.data
}
