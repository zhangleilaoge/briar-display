import { apiClient } from '@/api/request'
import type { ApiResponse, WikiPageSummary, WikiPaginatedResponse } from '@briar/shared'
import { handleError } from './utils'

export const starApi = {
	async getStars(limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiPageSummary>>>(
				'/wiki/stars',
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiPageSummary>>
		}
	},

	async addStar(slug: string) {
		try {
			const response = await apiClient.post<ApiResponse<{ starred: boolean }>>(
				`/wiki/stars/${slug}`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<{ starred: boolean }>
		}
	},

	async removeStar(slug: string) {
		try {
			const response = await apiClient.delete<ApiResponse<{ starred: boolean }>>(
				`/wiki/stars/${slug}`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<{ starred: boolean }>
		}
	},

	async isStarred(slug: string) {
		try {
			const response = await apiClient.get<ApiResponse<{ starred: boolean }>>(
				`/wiki/stars/${slug}/status`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<{ starred: boolean }>
		}
	},
}
