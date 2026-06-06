import { apiClient } from '@/api/request'
import type {
	ApiResponse,
	CreateWikiChangeRequestPayload,
	CreateWikiDiscussionPayload,
	CreateWikiInlineCommentPayload,
	CreateWikiReplyPayload,
	ReviewWikiChangeRequestPayload,
	WikiChangeRequest,
	WikiDiscussion,
	WikiDiscussionReply,
	WikiInlineComment,
	WikiPaginatedResponse,
} from '@briar/shared'
import { handleError } from './utils'

export const discussionApi = {
	// Discussions
	async getTopics(slug: string, limit?: number, offset?: number) {
		try {
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiDiscussion>>>(
				`/wiki/pages/${slug}/discussions`,
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiDiscussion>>
		}
	},

	async createTopic(slug: string, payload: CreateWikiDiscussionPayload) {
		try {
			const response = await apiClient.post<ApiResponse<WikiDiscussion>>(
				`/wiki/pages/${slug}/discussions`,
				payload,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiDiscussion>
		}
	},

	async getReplies(slug: string, topicId: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiDiscussionReply[]>>(
				`/wiki/pages/${slug}/discussions/${topicId}/replies`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiDiscussionReply[]>
		}
	},

	async createReply(slug: string, topicId: string, payload: CreateWikiReplyPayload) {
		try {
			const response = await apiClient.post<ApiResponse<WikiDiscussionReply>>(
				`/wiki/pages/${slug}/discussions/${topicId}/replies`,
				payload,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiDiscussionReply>
		}
	},

	async markResolved(slug: string, topicId: string) {
		try {
			const response = await apiClient.put<ApiResponse>(
				`/wiki/pages/${slug}/discussions/${topicId}/resolve`,
			)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},

	// Inline Comments
	async getInlineComments(slug: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiInlineComment[]>>(
				`/wiki/pages/${slug}/comments`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiInlineComment[]>
		}
	},

	async getInlineCommentsByAnchor(slug: string, anchor: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiInlineComment[]>>(
				`/wiki/pages/${slug}/comments/${anchor}`,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiInlineComment[]>
		}
	},

	async createInlineComment(slug: string, payload: CreateWikiInlineCommentPayload) {
		try {
			const response = await apiClient.post<ApiResponse<WikiInlineComment>>(
				`/wiki/pages/${slug}/comments`,
				payload,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiInlineComment>
		}
	},

	async updateInlineComment(
		slug: string,
		id: string,
		payload: { content?: string; resolved?: boolean },
	) {
		try {
			const response = await apiClient.put<ApiResponse<WikiInlineComment>>(
				`/wiki/pages/${slug}/comments/${id}`,
				payload,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiInlineComment>
		}
	},

	async deleteInlineComment(slug: string, id: string) {
		try {
			const response = await apiClient.delete<ApiResponse>(`/wiki/pages/${slug}/comments/${id}`)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},

	// Change Requests
	async getChangeRequests(slug: string, status?: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiChangeRequest[]>>(
				`/wiki/pages/${slug}/change-requests`,
				{ params: { status } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiChangeRequest[]>
		}
	},

	async getMyChangeRequests() {
		try {
			const response = await apiClient.get<ApiResponse<WikiChangeRequest[]>>(
				'/wiki/change-requests/my',
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiChangeRequest[]>
		}
	},

	async createChangeRequest(slug: string, payload: CreateWikiChangeRequestPayload) {
		try {
			const response = await apiClient.post<ApiResponse<WikiChangeRequest>>(
				`/wiki/pages/${slug}/change-requests`,
				payload,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiChangeRequest>
		}
	},

	async reviewChangeRequest(id: string, payload: ReviewWikiChangeRequestPayload) {
		try {
			const response = await apiClient.put<ApiResponse<WikiChangeRequest>>(
				`/wiki/change-requests/${id}/review`,
				payload,
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiChangeRequest>
		}
	},

	async deleteChangeRequest(id: string) {
		try {
			const response = await apiClient.delete<ApiResponse>(`/wiki/change-requests/${id}`)
			return response.data
		} catch (error) {
			return handleError(error)
		}
	},
}
