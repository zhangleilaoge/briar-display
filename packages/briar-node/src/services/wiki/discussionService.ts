import { discussionDal } from '../../dal/wiki/discussionDal'
import { pageDal } from '../../dal/wiki/pageDal'

export const discussionService = {
	/**
	 * Create a discussion topic for a page
	 */
	async createTopic(slug: string, title: string, authorId: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		return discussionDal.create({
			pageId: page.id,
			title,
			authorId,
		})
	},

	/**
	 * List discussion topics for a page
	 */
	async getTopics(slug: string, limit = 20, offset = 0) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		return discussionDal.listByPage(page.id, limit, offset)
	},

	/**
	 * Create a reply in a discussion topic
	 */
	async createReply(
		slug: string,
		topicId: string,
		content: string,
		authorId: string,
		parentReplyId?: string,
	) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		const topic = await discussionDal.findById(topicId)
		if (!topic || topic.pageId !== page.id) {
			throw new Error('TOPIC_NOT_FOUND')
		}

		return discussionDal.createReply({
			topicId,
			content,
			authorId,
			parentReplyId: parentReplyId || null,
		})
	},

	/**
	 * Get replies for a discussion topic
	 */
	async getReplies(slug: string, topicId: string, limit = 50, offset = 0) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		const topic = await discussionDal.findById(topicId)
		if (!topic || topic.pageId !== page.id) {
			throw new Error('TOPIC_NOT_FOUND')
		}

		return discussionDal.getReplies(topicId, limit, offset)
	},

	/**
	 * Mark a discussion topic as resolved
	 */
	async markResolved(slug: string, topicId: string, _userId: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		const topic = await discussionDal.findById(topicId)
		if (!topic || topic.pageId !== page.id) {
			throw new Error('TOPIC_NOT_FOUND')
		}

		return discussionDal.markResolved(topicId)
	},
}
