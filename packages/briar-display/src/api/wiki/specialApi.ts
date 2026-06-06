import { apiClient } from '@/api/request'
import type {
	ApiResponse,
	WikiPageSummary,
	WikiPaginatedResponse,
	WikiRecentChange,
	WikiStatistics,
	WikiUserContribution,
	WikiWantedPage,
} from '@briar/shared'
import { handleError } from './utils'

export const specialApi = {
	async recentChanges(limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiRecentChange>>>(
				'/wiki/special/recent-changes',
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiRecentChange>>
		}
	},

	async statistics() {
		try {
			const response = await apiClient.get<ApiResponse<WikiStatistics>>('/wiki/special/statistics')
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiStatistics>
		}
	},

	async allPages(limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiPageSummary>>>(
				'/wiki/special/all-pages',
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiPageSummary>>
		}
	},

	async orphanedPages(limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiPageSummary>>>(
				'/wiki/special/orphaned-pages',
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiPageSummary>>
		}
	},

	async wantedPages(limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiWantedPage>>>(
				'/wiki/special/wanted-pages',
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiWantedPage>>
		}
	},

	async userContributions(userId: string, limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<
				ApiResponse<WikiPaginatedResponse<WikiUserContribution>>
			>(`/wiki/special/user-contributions/${userId}`, { params: { limit, offset } })
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiUserContribution>>
		}
	},
}
