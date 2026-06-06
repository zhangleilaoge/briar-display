import { apiClient } from '@/api/request'
import type {
	ApiResponse,
	CreateWikiPagePayload,
	UpdateWikiPagePayload,
	WikiBacklink,
	WikiCategory,
	WikiDiffResult,
	WikiPage,
	WikiPageSummary,
	WikiPaginatedResponse,
	WikiRevision,
	WikiSearchResult,
	WikiTag,
} from '@briar/shared'
import { handleError } from './utils'

export const pageApi = {
	async list(params: { limit?: number; offset?: number; namespace?: string; status?: string }) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiPageSummary>>>(
				'/wiki/pages',
				{ params },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiPageSummary>>
		}
	},

	async search(query: string, limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiSearchResult>>>(
				'/wiki/pages/search',
				{ params: { q: query, limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiSearchResult>>
		}
	},

	async createPage(payload: CreateWikiPagePayload) {
		try {
			const response = await apiClient.post<ApiResponse<WikiPage>>('/wiki/pages', payload)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPage>
		}
	},

	async getBySlug(slug: string, namespace = 'main') {
		try {
			const response = await apiClient.get<ApiResponse<WikiPage>>(
				`/wiki/pages/${namespace}/${slug}`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPage>
		}
	},

	async getPageDetails(slug: string, namespace = 'main') {
		try {
			const response = await apiClient.get<
				ApiResponse<
					WikiPage & {
						categories: WikiCategory[]
						tags: WikiTag[]
						backlinks: WikiBacklink[]
						subpages: WikiPageSummary[]
					}
				>
			>(`/wiki/pages/${namespace}/${slug}/details`)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<
				WikiPage & {
					categories: WikiCategory[]
					tags: WikiTag[]
					backlinks: WikiBacklink[]
					subpages: WikiPageSummary[]
				}
			>
		}
	},

	async updatePage(slug: string, payload: UpdateWikiPagePayload & { lastReadAt?: string }) {
		try {
			const response = await apiClient.put<ApiResponse<WikiPage>>(`/wiki/pages/${slug}`, payload)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPage>
		}
	},

	async deletePage(slug: string) {
		try {
			const response = await apiClient.delete<ApiResponse>(`/wiki/pages/${slug}`)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},

	async getBacklinks(slug: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiBacklink[]>>(
				`/wiki/pages/${slug}/backlinks`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiBacklink[]>
		}
	},

	async getSubpages(slug: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPageSummary[]>>(
				`/wiki/pages/${slug}/subpages`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPageSummary[]>
		}
	},

	// Revisions
	async getRevisions(slug: string, limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiRevision>>>(
				`/wiki/pages/${slug}/revisions`,
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiRevision>>
		}
	},

	async getRevision(slug: string, revId: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiRevision>>(
				`/wiki/pages/${slug}/revisions/${revId}`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiRevision>
		}
	},

	async getDiff(slug: string, from: number, to: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiDiffResult>>(
				`/wiki/pages/${slug}/diff`,
				{
					params: { from, to },
				},
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiDiffResult>
		}
	},

	async revertToRevision(slug: string, revId: string) {
		try {
			const response = await apiClient.post<ApiResponse<WikiPage>>(
				`/wiki/pages/${slug}/revisions/${revId}/revert`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPage>
		}
	},
}
