import type { CreateWikiPagePayload, UpdateWikiPagePayload } from '@briar/shared'
import { backlinkDal } from '../../dal/wiki/backlinkDal'
import { categoryDal } from '../../dal/wiki/categoryDal'
import { pageDal } from '../../dal/wiki/pageDal'
import { revisionDal } from '../../dal/wiki/revisionDal'
import { tagDal } from '../../dal/wiki/tagDal'
import {
	extractMentions,
	extractTransclusions,
	resolveTransclusions,
	updateBacklinks,
} from './backlinkService'
import { tagService } from './tagService'

export const pageService = {
	/**
	 * Generate URL-friendly slug from title
	 * Supports CJK: preserve non-ASCII characters
	 */
	generateSlug(title: string): string {
		return title
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9\s\u4e00-\u9fff]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
	},

	/**
	 * Ensure slug uniqueness by appending numeric suffix if needed
	 */
	async ensureUniqueSlug(title: string, namespace: string, excludeId?: string): Promise<string> {
		let slug = pageService.generateSlug(title)
		let counter = 1

		while (await pageDal.checkSlugExists(namespace as any, slug, excludeId)) {
			slug = `${pageService.generateSlug(title)}-${counter}`
			counter++
		}

		return slug
	},

	/**
	 * Strip markdown formatting and return first 500 chars as summary
	 */
	generateSummary(content: string): string {
		const stripped = content
			.replace(/#{1,6}\s/g, '')
			.replace(/\*\*(.*?)\*\*/g, '$1')
			.replace(/\*(.*?)\*/g, '$1')
			.replace(/`(.*?)`/g, '$1')
			.replace(/```[\s\S]*?```/g, '')
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			.replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
			.replace(/^[-*+]\s/gm, '')
			.replace(/^\d+\.\s/gm, '')
			.replace(/^>\s/gm, '')
			.replace(/---/g, '')
			.replace(/\n+/g, ' ')
			.trim()

		return stripped.substring(0, 500)
	},

	/**
	 * Render HTML from markdown (placeholder)
	 * TODO: Implement proper markdown rendering
	 */
	renderHtml(_content: string): string | null {
		return null
	},

	/**
	 * List wiki pages
	 */
	async list(params: {
		namespace?: string
		status?: string
		limit?: number
		offset?: number
		userId?: string
	}) {
		return pageDal.list({
			limit: params.limit || 20,
			offset: params.offset || 0,
			namespace: params.namespace as any,
			status: params.status as any,
			userId: params.userId,
		})
	},

	/**
	 * Create a new wiki page
	 */
	async create(payload: CreateWikiPagePayload, authorId: string) {
		const namespace = payload.namespace || 'main'
		const status = payload.status || 'published'
		const visibility = payload.visibility || 'public'
		const slug = await pageService.ensureUniqueSlug(payload.title, namespace)
		const summary = pageService.generateSummary(payload.content)
		const renderedHtml = pageService.renderHtml(payload.content)

		const page = await pageDal.create({
			title: payload.title,
			slug,
			content: payload.content,
			renderedHtml,
			summary,
			namespace,
			status,
			visibility,
			authorId,
			lastEditorId: null,
			isRedirect: false,
			redirectTarget: null,
			parentId: payload.parentId || null,
		})

		// Create initial revision
		await revisionDal.create({
			pageId: page.id,
			content: payload.content,
			summary: 'Initial creation',
			editorId: authorId,
			revisionNumber: 1,
			sizeBefore: 0,
			sizeAfter: payload.content.length,
			minorEdit: false,
		})

		// Assign categories if provided
		if (payload.categoryIds && payload.categoryIds.length > 0) {
			await categoryDal.setPageCategories(page.id, payload.categoryIds)
			for (const catId of payload.categoryIds) {
				await categoryDal.incrementPageCount(catId)
			}
		}

		// Assign tags if provided
		if (payload.tagNames && payload.tagNames.length > 0) {
			const tags = await tagService.getOrCreateTags(payload.tagNames)
			await tagDal.setPageTags(
				page.id,
				tags.map((t) => t.id),
			)
			for (const tag of tags) {
				await tagDal.incrementPageCount(tag.id)
			}
		}

		// Update backlinks (mentions in content)
		await updateBacklinks(page.id, payload.content)

		return page
	},

	/**
	 * Update an existing wiki page
	 */
	async update(slug: string, payload: UpdateWikiPagePayload, userId: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		if (page.authorId !== userId && page.lastEditorId !== userId) {
			throw new Error('FORBIDDEN')
		}

		const updates: any = {}
		updates.lastEditorId = userId

		if (payload.title !== undefined) {
			updates.title = payload.title
			updates.slug = await pageService.ensureUniqueSlug(payload.title, page.namespace, page.id)
		}

		if (payload.content !== undefined) {
			updates.content = payload.content
			updates.summary = pageService.generateSummary(payload.content)
			updates.renderedHtml = pageService.renderHtml(payload.content)
		}

		if (payload.status !== undefined) {
			updates.status = payload.status
		}
		if (payload.visibility !== undefined) {
			updates.visibility = payload.visibility
		}
		if (payload.parentId !== undefined) {
			updates.parentId = payload.parentId
		}

		// Create revision if content changed
		if (payload.content !== undefined) {
			const latestRevNum = await revisionDal.getLatestRevisionNumber(page.id)
			await revisionDal.create({
				pageId: page.id,
				content: payload.content,
				summary: payload.editSummary || null,
				editorId: userId,
				revisionNumber: latestRevNum + 1,
				sizeBefore: page.content.length,
				sizeAfter: payload.content.length,
				minorEdit: payload.minorEdit || false,
			})
		}

		// Update categories if provided
		if (payload.categoryIds !== undefined) {
			const oldCategories = await categoryDal.getPageCategories(page.id)
			await categoryDal.setPageCategories(page.id, payload.categoryIds)
			// Update counts
			for (const cat of oldCategories) {
				if (!payload.categoryIds.includes(cat.id)) {
					await categoryDal.decrementPageCount(cat.id)
				}
			}
			for (const catId of payload.categoryIds) {
				if (!oldCategories.find((c) => c.id === catId)) {
					await categoryDal.incrementPageCount(catId)
				}
			}
		}

		// Update tags if provided
		if (payload.tagNames !== undefined) {
			const oldTags = await tagDal.listByPageId(page.id)
			const newTags = await tagService.getOrCreateTags(payload.tagNames)
			const newTagIds = newTags.map((t) => t.id)

			await tagDal.setPageTags(page.id, newTagIds)

			// Update counts
			for (const tag of oldTags) {
				if (!newTagIds.includes(tag.id)) {
					await tagDal.decrementPageCount(tag.id)
				}
			}
			for (const tag of newTags) {
				if (!oldTags.find((t) => t.id === tag.id)) {
					await tagDal.incrementPageCount(tag.id)
				}
			}
		}

		const updatedPage = await pageDal.update(page.id, updates)

		// Update backlinks after content change
		if (payload.content !== undefined && updatedPage) {
			await updateBacklinks(page.id, payload.content)
		}

		return updatedPage
	},

	/**
	 * Soft delete a page with ownership check
	 * @param canDeleteAny - true 时可删除任意文章（moderator+），false 时只能删自己的
	 */
	async delete(slug: string, userId: string, canDeleteAny = false): Promise<boolean> {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		if (!canDeleteAny && page.authorId !== userId) {
			throw new Error('FORBIDDEN')
		}

		return pageDal.delete(page.id)
	},

	/**
	 * Get page by slug with redirect following
	 */
	async getBySlug(namespace: string, slug: string) {
		const page = await pageDal.findBySlug(namespace as any, slug)
		if (!page) {
			return null
		}

		// Follow redirects
		if (page.isRedirect && page.redirectTarget) {
			const target = await pageDal.findBySlug(namespace as any, page.redirectTarget)
			if (target) {
				return { ...target, redirectedFrom: page.slug }
			}
		}

		return page
	},

	/**
	 * Get page with full details (categories, tags, backlinks)
	 */
	async getPageDetails(namespace: string, slug: string) {
		const page = await pageService.getBySlug(namespace, slug)
		if (!page) {
			return null
		}

		const [categories, tags, backlinks, subpages] = await Promise.all([
			categoryDal.getPageCategories(page.id),
			tagDal.listByPageId(page.id),
			backlinkDal.findByTargetPage(page.id),
			pageDal.list({
				limit: 100,
				offset: 0,
				namespace: page.namespace,
			}),
		])

		// Filter subpages (pages with this page as parent)
		const childPages = subpages.items.filter((p) => p.parentId === page.id)

		return {
			...page,
			categories,
			tags,
			backlinks,
			subpages: childPages,
		}
	},

	/**
	 * Search pages
	 */
	async search(queryStr: string, limit = 20, offset = 0, userId?: string) {
		if (!queryStr || !queryStr.trim()) {
			return { items: [], total: 0 }
		}
		return pageDal.search(queryStr.trim(), limit, offset, userId)
	},

	/**
	 * Get subpages of a page
	 */
	async getSubpages(parentId: string, limit = 20, offset = 0) {
		return pageDal.listSubpages(parentId, limit, offset)
	},
}
