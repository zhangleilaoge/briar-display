import { apiClient } from '@/api/request'
import type {
	ApiResponse,
	CreateWikiCategoryPayload,
	CreateWikiChangeRequestPayload,
	CreateWikiDiscussionPayload,
	CreateWikiInlineCommentPayload,
	CreateWikiPagePayload,
	CreateWikiReplyPayload,
	CreateWikiTagPayload,
	CreateWikiTemplatePayload,
	ReviewWikiChangeRequestPayload,
	UpdateWikiCategoryPayload,
	UpdateWikiPagePayload,
	UpdateWikiTemplatePayload,
	WikiBacklink,
	WikiCategory,
	WikiCategoryTreeNode,
	WikiChangeRequest,
	WikiDiffResult,
	WikiDiscussion,
	WikiDiscussionReply,
	WikiInlineComment,
	WikiPage,
	WikiPageSummary,
	WikiPaginatedResponse,
	WikiRecentChange,
	WikiRevision,
	WikiSearchResult,
	WikiStar,
	WikiStatistics,
	WikiTag,
	WikiTemplate,
	WikiUserContribution,
	WikiWatchlistItem,
} from '@briar/shared'

const handleError = (error: unknown): ApiResponse => {
	const message = error instanceof Error ? error.message : '请求失败'
	return { success: false, message, code: 500 }
}

export const wikiApi = {
	// ===================== Pages =====================

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

	// ===================== Revisions =====================

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
				{ params: { from, to } },
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

	// ===================== Categories =====================

	async getCategoryTree() {
		try {
			const response =
				await apiClient.get<ApiResponse<WikiCategoryTreeNode[]>>('/wiki/categories/tree')
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiCategoryTreeNode[]>
		}
	},

	async getCategory(slug: string) {
		try {
			const response = await apiClient.get<ApiResponse<WikiCategory>>(`/wiki/categories/${slug}`)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiCategory>
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

	// ===================== Tags =====================

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

	// ===================== Stars =====================

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

	// ===================== Discussions =====================

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

	// ===================== Inline Comments =====================

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

	// ===================== Change Requests =====================

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

	// ===================== Templates =====================

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

	// ===================== Watchlist =====================

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

	// ===================== Special Pages =====================

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
			const response = await apiClient.get<ApiResponse<WikiPaginatedResponse<WikiPageSummary>>>(
				'/wiki/special/wanted-pages',
				{ params: { limit, offset } },
			)
			return response.data
		} catch (error) {
			return handleError(error) as ApiResponse<WikiPaginatedResponse<WikiPageSummary>>
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
