import type { CreateWikiPagePayload, UpdateWikiPagePayload } from '@briar/shared'
import { categoryDal } from '../../dal/wiki/categoryDal'
import { pageDal } from '../../dal/wiki/pageDal'
import { revisionDal } from '../../dal/wiki/revisionDal'

export const pageService = {
	/**
	 * Generate URL-friendly slug from title
	 * Supports CJK: percent-encode non-ASCII characters
	 */
	generateSlug(title: string): string {
		// Check if title contains non-ASCII characters (CJK, etc.)
		if (title.split('').some((c) => c.charCodeAt(0) > 127)) {
			return encodeURIComponent(title.trim()).replace(/%20/g, '-')
		}
		return title
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9\s-]/g, '')
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
	 * Create a new wiki page
	 */
	async create(payload: CreateWikiPagePayload, authorId: string) {
		const namespace = payload.namespace || 'main'
		const status = payload.status || 'published'
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
			authorId,
			lastEditorId: null,
			isRedirect: false,
			redirectTarget: null,
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

		return pageDal.update(page.id, updates)
	},

	/**
	 * Soft delete a page with ownership check
	 */
	async delete(slug: string, userId: string): Promise<boolean> {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		if (page.authorId !== userId) {
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
	 * Search pages
	 */
	async search(queryStr: string, limit = 20, offset = 0) {
		if (!queryStr || !queryStr.trim()) {
			return { items: [], total: 0 }
		}
		return pageDal.search(queryStr.trim(), limit, offset)
	},
}
