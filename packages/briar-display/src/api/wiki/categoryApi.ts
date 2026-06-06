import { apiClient } from '@/api/request'
import type {
	ApiResponse,
	CreateWikiCategoryPayload,
	UpdateWikiCategoryPayload,
	WikiCategory,
	WikiCategoryTreeNode,
	WikiPageSummary,
	WikiPaginatedResponse,
} from '@briar/shared'
import { handleError } from './utils'

export const categoryApi = {
	async getCategoryTree() {
		try {
			const response =
				await apiClient.get<ApiResponse<WikiCategoryTreeNode[]>>('/wiki/categories/tree')
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiCategoryTreeNode[]>
		}
	},

	async getCategory(slug: string, limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<
				ApiResponse<
					WikiCategory & {
						pages: WikiPaginatedResponse<WikiPageSummary>
						subcategories: WikiCategoryTreeNode[]
					}
				>
			>(`/wiki/categories/${slug}`, { params: { limit, offset } })
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<
				WikiCategory & {
					pages: WikiPaginatedResponse<WikiPageSummary>
					subcategories: WikiCategoryTreeNode[]
				}
			>
		}
	},

	async createCategory(payload: CreateWikiCategoryPayload) {
		try {
			const response = await apiClient.post<ApiResponse<WikiCategory>>('/wiki/categories', payload)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiCategory>
		}
	},

	async updateCategory(slug: string, payload: UpdateWikiCategoryPayload) {
		try {
			const response = await apiClient.put<ApiResponse<WikiCategory>>(
				`/wiki/categories/${slug}`,
				payload,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiCategory>
		}
	},

	async deleteCategory(slug: string) {
		try {
			const response = await apiClient.delete<ApiResponse>(`/wiki/categories/${slug}`)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},
}
