import type {
	CreateWikiCategoryPayload,
	UpdateWikiCategoryPayload,
	WikiCategoryTreeNode,
} from '@briar/shared'
import { categoryDal } from '../../dal/wiki/categoryDal'

export const categoryService = {
	/**
	 * Create a new category
	 */
	async create(payload: CreateWikiCategoryPayload) {
		const slug = payload.name
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-\u4e00-\u9fff]/g, '')
			.replace(/-+/g, '-')

		const existing = await categoryDal.findBySlug(slug)
		if (existing) {
			throw new Error('CATEGORY_EXISTS')
		}

		return categoryDal.create({
			name: payload.name,
			slug,
			description: payload.description || null,
			parentId: payload.parentId || null,
		})
	},

	/**
	 * Update a category
	 */
	async update(slug: string, payload: UpdateWikiCategoryPayload) {
		const category = await categoryDal.findBySlug(slug)
		if (!category) {
			throw new Error('CATEGORY_NOT_FOUND')
		}

		const updates: any = {}

		if (payload.name !== undefined) {
			updates.name = payload.name
		}
		if (payload.description !== undefined) {
			updates.description = payload.description
		}
		if (payload.parentId !== undefined) {
			updates.parentId = payload.parentId
		}

		return categoryDal.update(category.id, updates)
	},

	/**
	 * Delete a category
	 */
	async delete(slug: string): Promise<boolean> {
		const category = await categoryDal.findBySlug(slug)
		if (!category) {
			throw new Error('CATEGORY_NOT_FOUND')
		}
		return categoryDal.delete(category.id)
	},

	/**
	 * Build category tree from flat list
	 */
	async getTree(): Promise<WikiCategoryTreeNode[]> {
		const categories = await categoryDal.getTree()

		const nodeMap = new Map<string, WikiCategoryTreeNode>()
		const roots: WikiCategoryTreeNode[] = []

		// Create tree nodes
		for (const cat of categories) {
			nodeMap.set(cat.id, { ...cat, children: [] })
		}

		// Build tree structure
		for (const cat of categories) {
			const node = nodeMap.get(cat.id)!
			if (cat.parentId && nodeMap.has(cat.parentId)) {
				nodeMap.get(cat.parentId)!.children.push(node)
			} else {
				roots.push(node)
			}
		}

		return roots
	},

	/**
	 * Get category with its pages
	 */
	async getCategoryWithPages(slug: string, limit = 20, offset = 0) {
		const category = await categoryDal.findBySlug(slug)
		if (!category) {
			throw new Error('CATEGORY_NOT_FOUND')
		}

		const pages = await categoryDal.getCategoryPages(category.id, limit, offset)

		return {
			category,
			pages,
		}
	},
}
