import { apiClient } from '@/api/request'
import type { ApiResponse, WikiPaginatedResponse, WikiWatchlistItem } from '@briar/shared'
import { handleError } from './utils'

export const watchlistApi = {
	async getWatchlist(limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiWatchlistItem>>>(
				'/wiki/watchlist',
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiWatchlistItem>>
		}
	},

	async addToWatchlist(slug: string) {
		try {
			const response = await apiClient.post<ApiResponse>(`/wiki/watchlist/${slug}`)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},

	async removeFromWatchlist(slug: string) {
		try {
			const response = await apiClient.delete<ApiResponse>(`/wiki/watchlist/${slug}`)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},

	async isWatching(slug: string) {
		try {
			const response = await apiClient.get<ApiResponse<{ watching: boolean }>>(
				`/wiki/watchlist/${slug}/status`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<{ watching: boolean }>
		}
	},
}
