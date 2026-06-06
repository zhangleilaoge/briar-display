import { apiClient } from '@/api/request'
import type { ApiResponse, CreateWikiTagPayload, WikiTag } from '@briar/shared'
import { handleError } from './utils'

export const tagApi = {
	async getTags() {
		try {
			const response = await apiClient.get<ApiResponse<WikiTag[]>>('/wiki/tags')
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiTag[]>
		}
	},

	async getTag(slug: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiTag>>(`/wiki/tags/${slug}`)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiTag>
		}
	},

	async createTag(payload: CreateWikiTagPayload) {
		try {
			const response = await apiClient.post<ApiResponse<WikiTag>>('/wiki/tags', payload)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiTag>
		}
	},

	async deleteTag(id: string) {
		try {
			const response = await apiClient.delete<ApiResponse>(`/wiki/tags/${id}`)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},

	async getTagPages(slug: string, options?: { limit?: number; offset?: number }) {
		try {
			const response = await apiClient.get<
				ApiResponse<{
					tag: WikiTag
					pages: {
						id: string
						title: string
						slug: string
						namespace: string
						summary: string | null
						updatedAt: string
					}[]
					total: number
				}>
			>(`/wiki/tags/${slug}/pages`, { params: options })
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<{
				tag: WikiTag
				pages: {
					id: string
					title: string
					slug: string
					namespace: string
					summary: string | null
					updatedAt: string
				}[]
				total: number
			}>
		}
	},
}
