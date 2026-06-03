import { pageDal } from '../../dal/wiki/pageDal'
import { watchlistDal } from '../../dal/wiki/watchlistDal'

export const watchlistService = {
	/**
	 * Add a page to user's watchlist
	 */
	async add(slug: string, userId: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		await watchlistDal.add(userId, page.id)
		return { watching: true }
	},

	/**
	 * Remove a page from user's watchlist
	 */
	async remove(slug: string, userId: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		await watchlistDal.remove(userId, page.id)
		return { watching: false }
	},

	/**
	 * Check if user is watching a page
	 */
	async isWatching(slug: string, userId: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		return watchlistDal.isWatching(userId, page.id)
	},

	/**
	 * List user's watchlist
	 */
	async listByUser(userId: string, limit = 20, offset = 0) {
		return watchlistDal.listByUser(userId, limit, offset)
	},
}
