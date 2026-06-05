import { pageDal } from '../../dal/wiki/pageDal'
import { starDal } from '../../dal/wiki/starDal'

export const starService = {
	async add(userId: string, slug: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}
		await starDal.add(userId, page.id)
		return { starred: true }
	},

	async remove(userId: string, slug: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}
		await starDal.remove(userId, page.id)
		return { starred: false }
	},

	async isStarred(userId: string, slug: string): Promise<boolean> {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			return false
		}
		return starDal.isStarred(userId, page.id)
	},

	async listByUser(userId: string, limit = 50, offset = 0) {
		const stars = await starDal.listByUser(userId, limit, offset)
		const total = await starDal.countByUser(userId)

		// Fetch page details for each star
		const pageIds = stars.map((s) => s.pageId)
		const pages: Record<string, any> = {}
		for (const pageId of pageIds) {
			const page = await pageDal.findById(pageId)
			if (page) {
				pages[pageId] = page
			}
		}

		return {
			items: stars.map((s) => pages[s.pageId]).filter(Boolean),
			total,
			limit,
			offset,
		}
	},
}
