import type { CreateWikiTemplatePayload, UpdateWikiTemplatePayload } from '@briar/shared'
import { templateDal } from '../../dal/wiki/templateDal'

export const templateService = {
	/**
	 * Create a new template
	 */
	async create(payload: CreateWikiTemplatePayload, authorId: string) {
		const slug = payload.name
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-\u4e00-\u9fff]/g, '')
			.replace(/-+/g, '-')

		const existing = await templateDal.findBySlug(slug)
		if (existing) {
			throw new Error('TEMPLATE_EXISTS')
		}

		return templateDal.create({
			name: payload.name,
			slug,
			content: payload.content,
			description: payload.description || null,
			authorId,
		})
	},

	/**
	 * Update a template
	 */
	async update(slug: string, payload: UpdateWikiTemplatePayload) {
		const template = await templateDal.findBySlug(slug)
		if (!template) {
			throw new Error('TEMPLATE_NOT_FOUND')
		}

		return templateDal.update(template.id, payload)
	},

	/**
	 * Delete a template
	 */
	async delete(slug: string): Promise<boolean> {
		const template = await templateDal.findBySlug(slug)
		if (!template) {
			throw new Error('TEMPLATE_NOT_FOUND')
		}
		return templateDal.delete(template.id)
	},

	/**
	 * Get template by slug
	 */
	async getBySlug(slug: string) {
		return templateDal.findBySlug(slug)
	},

	/**
	 * List templates with pagination
	 */
	async list(limit = 20, offset = 0) {
		return templateDal.list(limit, offset)
	},
}
