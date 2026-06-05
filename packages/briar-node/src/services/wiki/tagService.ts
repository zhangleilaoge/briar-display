import { tagDal } from '../../dal/wiki/tagDal'

export const tagService = {
	async create(payload: { name: string; color?: string }) {
		const existing = await tagDal.findByName(payload.name.trim())
		if (existing) {
			throw new Error('TAG_EXISTS')
		}
		return tagDal.create(payload)
	},

	async list() {
		return tagDal.list()
	},

	async getBySlug(slug: string) {
		const tag = await tagDal.findBySlug(slug)
		if (!tag) {
			throw new Error('TAG_NOT_FOUND')
		}
		return tag
	},

	async delete(id: string) {
		const deleted = await tagDal.delete(id)
		if (!deleted) {
			throw new Error('TAG_NOT_FOUND')
		}
	},

	async getPagesByTagSlug(slug: string, options?: { limit?: number; offset?: number }) {
		const tag = await tagDal.findBySlug(slug)
		if (!tag) {
			throw new Error('TAG_NOT_FOUND')
		}
		const pages = await tagDal.listPagesByTagId(tag.id, options)
		return { tag, pages }
	},

	async getOrCreateTags(tagNames: string[]): Promise<{ id: string; name: string }[]> {
		const result: { id: string; name: string }[] = []

		for (const name of tagNames) {
			const trimmed = name.trim()
			if (!trimmed) continue

			let tag = await tagDal.findByName(trimmed)
			if (!tag) {
				tag = await tagDal.create({ name: trimmed })
			}
			result.push({ id: tag.id, name: tag.name })
		}

		return result
	},
}
