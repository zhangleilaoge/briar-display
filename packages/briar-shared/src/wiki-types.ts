/**
 * Wiki 相关共享类型定义
 * 对齐 MediaWiki 命名空间设计理念
 */

/** 命名空间枚举 */
export type WikiNamespace = 'main' | 'talk' | 'user' | 'template' | 'category'

/** 文章状态 */
export type WikiPageStatus = 'draft' | 'published' | 'protected' | 'deleted'

/** 页面可见性 */
export type WikiPageVisibility = 'public' | 'private' | 'link_only'

/** Wiki 页面（完整模型） */
export interface WikiPage {
	id: string
	title: string
	slug: string
	content: string
	renderedHtml: string | null
	summary: string | null
	namespace: WikiNamespace
	status: WikiPageStatus
	visibility: WikiPageVisibility
	authorId: string
	lastEditorId: string | null
	parentId: string | null
	viewCount: number
	isRedirect: boolean
	redirectTarget: string | null
	createdAt: Date
	updatedAt: Date
}

/** 页面列表项（不含完整内容） */
export type WikiPageSummary = Omit<WikiPage, 'content' | 'renderedHtml'> & {
	categories?: Pick<WikiCategory, 'id' | 'name' | 'slug'>[]
	tags?: Pick<WikiTag, 'id' | 'name' | 'slug' | 'color'>[]
	starred?: boolean
}

/** 版本记录 */
export interface WikiRevision {
	id: string
	pageId: string
	content: string
	summary: string | null
	editorId: string
	revisionNumber: number
	sizeBefore: number
	sizeAfter: number
	minorEdit: boolean
	createdAt: Date
}

/** 分类 */
export interface WikiCategory {
	id: string
	name: string
	slug: string
	description: string | null
	parentId: string | null
	pageCount: number
	createdAt: Date
	updatedAt: Date
}

/** 分类树节点（含子分类） */
export interface WikiCategoryTreeNode extends WikiCategory {
	children: WikiCategoryTreeNode[]
}

/** 页面-分类关联 */
export interface WikiPageCategory {
	pageId: string
	categoryId: string
}

/** 标签 */
export interface WikiTag {
	id: string
	name: string
	slug: string
	color: string
	pageCount: number
	createdAt: Date
}

/** 页面-标签关联 */
export interface WikiPageTag {
	pageId: string
	tagId: string
	createdAt: Date
}

/** 收藏 */
export interface WikiStar {
	userId: string
	pageId: string
	createdAt: Date
}

/** 反向链接 */
export interface WikiBacklink {
	id: string
	sourcePageId: string
	targetPageId: string
	sourceSlug: string
	targetSlug: string
	createdAt: Date
}

/** 内联评论 */
export interface WikiInlineComment {
	id: string
	pageId: string
	anchor: string
	content: string
	authorId: string
	resolved: boolean
	createdAt: Date
	updatedAt: Date
}

/** 变更请求状态 */
export type WikiChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'merged'

/** 变更请求 */
export interface WikiChangeRequest {
	id: string
	pageId: string
	title: string | null
	content: string | null
	summary: string | null
	status: WikiChangeRequestStatus
	requesterId: string
	reviewerId: string | null
	reviewComment: string | null
	createdAt: Date
	updatedAt: Date
	reviewedAt: Date | null
}

/** 讨论主题 */
export interface WikiDiscussion {
	id: string
	pageId: string
	title: string
	authorId: string
	resolved: boolean
	createdAt: Date
	replyCount?: number
}

/** 讨论回复 */
export interface WikiDiscussionReply {
	id: string
	topicId: string
	content: string
	authorId: string
	parentReplyId: string | null
	createdAt: Date
}

/** 关注列表项 */
export interface WikiWatchlistItem {
	userId: string
	pageId: string
	createdAt: Date
}

/** 模板 */
export interface WikiTemplate {
	id: string
	name: string
	slug: string
	content: string
	description: string | null
	authorId: string
	usageCount: number
	createdAt: Date
	updatedAt: Date
}

// ===================== API Payload Types =====================

/** 创建文章 */
export interface CreateWikiPagePayload {
	title: string
	content: string
	namespace?: WikiNamespace
	status?: WikiPageStatus
	visibility?: WikiPageVisibility
	categoryIds?: string[]
	tagNames?: string[]
	parentId?: string | null
}

/** 更新文章 */
export interface UpdateWikiPagePayload {
	title?: string
	content?: string
	status?: WikiPageStatus
	visibility?: WikiPageVisibility
	categoryIds?: string[]
	tagNames?: string[]
	parentId?: string | null
	editSummary?: string
	minorEdit?: boolean
}

/** 创建分类 */
export interface CreateWikiCategoryPayload {
	name: string
	description?: string
	parentId?: string
}

/** 更新分类 */
export interface UpdateWikiCategoryPayload {
	name?: string
	description?: string
	parentId?: string | null
}

/** 创建标签 */
export interface CreateWikiTagPayload {
	name: string
	color?: string
}

/** 创建内联评论 */
export interface CreateWikiInlineCommentPayload {
	anchor: string
	content: string
}

/** 创建变更请求 */
export interface CreateWikiChangeRequestPayload {
	title?: string
	content?: string
	summary?: string
}

/** 审核变更请求 */
export interface ReviewWikiChangeRequestPayload {
	status: 'approved' | 'rejected'
	comment?: string
}

/** 创建讨论主题 */
export interface CreateWikiDiscussionPayload {
	title: string
}

/** 创建回复 */
export interface CreateWikiReplyPayload {
	content: string
	parentReplyId?: string
}

/** 创建模板 */
export interface CreateWikiTemplatePayload {
	name: string
	content: string
	description?: string
}

/** 更新模板 */
export interface UpdateWikiTemplatePayload {
	name?: string
	content?: string
	description?: string
}

// ===================== API Response Types =====================

/** 搜索结果项 */
export interface WikiSearchResult {
	id: string
	title: string
	slug: string
	namespace: WikiNamespace
	summary: string | null
	relevance: number
	highlight?: string
}

/** Diff 行 */
export interface WikiDiffLine {
	type: 'added' | 'removed' | 'unchanged'
	content: string
	oldLineNum?: number
	newLineNum?: number
}

/** Diff 结果 */
export interface WikiDiffResult {
	fromRevision: number
	toRevision: number
	lines: WikiDiffLine[]
	additions: number
	deletions: number
}

/** 特殊页面 - 最近更改项 */
export interface WikiRecentChange {
	pageId: string
	pageTitle: string
	pageSlug: string
	namespace: WikiNamespace
	editorId: string
	editorName: string
	revisionNumber: number
	summary: string | null
	sizeBefore: number
	sizeAfter: number
	minorEdit: boolean
	createdAt: Date
}

/** 特殊页面 - 统计数据 */
export interface WikiStatistics {
	totalPages: number
	totalArticles: number
	totalRevisions: number
	totalCategories: number
	totalTemplates: number
	totalUsers: number
	recentEdits24h: number
}

/** 用户贡献项 */
export interface WikiUserContribution {
	pageId: string
	pageTitle: string
	pageSlug: string
	revisionNumber: number
	summary: string | null
	sizeBefore: number
	sizeAfter: number
	createdAt: Date
}

/** 分页参数（Wiki 专用） */
export interface WikiPaginationParams {
	limit?: number
	offset?: number
}

/** 分页响应（Wiki 专用） */
export interface WikiPaginatedResponse<T> {
	items: T[]
	total: number
	limit: number
	offset: number
}
