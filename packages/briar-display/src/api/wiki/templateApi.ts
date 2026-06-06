import { apiClient } from '@/api/request'
import type {
	ApiResponse,
	CreateWikiTemplatePayload,
	UpdateWikiTemplatePayload,
	WikiPaginatedResponse,
	WikiTemplate,
} from '@briar/shared'
import { handleError } from './utils'

export const templateApi = {
	async getTemplates(limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiTemplate>>>(
				'/wiki/templates',
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiTemplate>>
		}
	},

	async getTemplate(slug: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiTemplate>>(`/wiki/templates/${slug}`)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiTemplate>
		}
	},

	async createTemplate(payload: CreateWikiTemplatePayload) {
		try {
			const response = await apiClient.post<ApiResponse<WikiTemplate>>('/wiki/templates', payload)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiTemplate>
		}
	},

	async updateTemplate(slug: string, payload: UpdateWikiTemplatePayload) {
		try {
			const response = await apiClient.put<ApiResponse<WikiTemplate>>(
				`/wiki/templates/${slug}`,
				payload,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiTemplate>
		}
	},

	async deleteTemplate(slug: string) {
		try {
			const response = await apiClient.delete<ApiResponse>(`/wiki/templates/${slug}`)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},
}
