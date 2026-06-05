import { inlineCommentDal } from '../../dal/wiki/inlineCommentDal'
import { pageDal } from '../../dal/wiki/pageDal'

export const inlineCommentService = {
	async create(pageSlug: string, payload: { anchor: string; content: string }, userId: string) {
		const page = await pageDal.findBySlug('main', pageSlug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		return inlineCommentDal.create({
			pageId: page.id,
			anchor: payload.anchor,
			content: payload.content,
			authorId: userId,
		})
	},

	async listByPage(pageSlug: string) {
		const page = await pageDal.findBySlug('main', pageSlug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		return inlineCommentDal.listByPage(page.id)
	},

	async listByAnchor(pageSlug: string, anchor: string) {
		const page = await pageDal.findBySlug('main', pageSlug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		return inlineCommentDal.listByAnchor(page.id, anchor)
	},

	async update(id: string, payload: { content?: string; resolved?: boolean }, userId: string) {
		const comment = await inlineCommentDal.findById(id)
		if (!comment) {
			throw new Error('COMMENT_NOT_FOUND')
		}

		// Only author can update content, anyone can mark resolved
		if (payload.content !== undefined && comment.authorId !== userId) {
			throw new Error('FORBIDDEN')
		}

		return inlineCommentDal.update(id, payload)
	},

	async delete(id: string, userId: string) {
		const comment = await inlineCommentDal.findById(id)
		if (!comment) {
			throw new Error('COMMENT_NOT_FOUND')
		}

		if (comment.authorId !== userId) {
			throw new Error('FORBIDDEN')
		}

		return inlineCommentDal.delete(id)
	},
}
