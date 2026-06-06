import type { WikiChangeRequestStatus } from '@briar/shared'
import { changeRequestDal } from '../../dal/wiki/changeRequestDal'
import { pageDal } from '../../dal/wiki/pageDal'
import { revisionDal } from '../../dal/wiki/revisionDal'

export const changeRequestService = {
	async create(
		pageSlug: string,
		payload: { title?: string; content?: string; summary?: string },
		requesterId: string,
	) {
		const page = await pageDal.findBySlug('main', pageSlug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		// Only allow change requests from non-authors
		if (page.authorId === requesterId) {
			throw new Error('AUTHOR_NO_REQUEST')
		}

		return changeRequestDal.create({
			pageId: page.id,
			title: payload.title,
			content: payload.content,
			summary: payload.summary,
			requesterId,
		})
	},

	async listByPage(pageSlug: string, status?: WikiChangeRequestStatus, limit = 20, offset = 0) {
		const page = await pageDal.findBySlug('main', pageSlug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		return changeRequestDal.listByPage(page.id, status, limit, offset)
	},

	async listByRequester(requesterId: string, limit = 20, offset = 0) {
		return changeRequestDal.listByRequester(requesterId, limit, offset)
	},

	async listPendingForReviewer(pageSlug?: string) {
		if (pageSlug) {
			const page = await pageDal.findBySlug('main', pageSlug)
			if (!page) {
				throw new Error('PAGE_NOT_FOUND')
			}
			return changeRequestDal.listPendingForReviewer(page.id)
		}
		return changeRequestDal.listPendingForReviewer()
	},

	async review(id: string, status: 'approved' | 'rejected', reviewerId: string, comment?: string) {
		const request = await changeRequestDal.findById(id)
		if (!request) {
			throw new Error('REQUEST_NOT_FOUND')
		}

		// Only page author can review
		const page = await pageDal.findById(request.pageId)
		if (!page || page.authorId !== reviewerId) {
			throw new Error('FORBIDDEN')
		}

		const updated = await changeRequestDal.updateStatus(id, status, reviewerId, comment)

		// If approved, auto-merge the changes
		if (status === 'approved') {
			await changeRequestService.merge(id, reviewerId)
		}

		return updated
	},

	async merge(id: string, reviewerId: string) {
		const request = await changeRequestDal.findById(id)
		if (!request) {
			throw new Error('REQUEST_NOT_FOUND')
		}

		const page = await pageDal.findById(request.pageId)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		// Apply the changes
		const updates: any = { lastEditorId: reviewerId }
		if (request.title !== null && request.title !== undefined) {
			updates.title = request.title
		}
		if (request.content !== null && request.content !== undefined) {
			updates.content = request.content
		}

		await pageDal.update(page.id, updates)

		// Create a revision for the merge
		if (request.content) {
			const latestRevNum = await revisionDal.getLatestRevisionNumber(page.id)
			await revisionDal.create({
				pageId: page.id,
				content: request.content,
				summary: request.summary || `Merged change request: ${request.summary || 'no summary'}`,
				editorId: reviewerId,
				revisionNumber: latestRevNum + 1,
				sizeBefore: page.content.length,
				sizeAfter: request.content.length,
				minorEdit: false,
			})
		}

		// Mark as merged
		await changeRequestDal.updateStatus(id, 'merged', reviewerId)

		return changeRequestDal.findById(id)
	},

	async delete(id: string, userId: string) {
		const request = await changeRequestDal.findById(id)
		if (!request) {
			throw new Error('REQUEST_NOT_FOUND')
		}

		// Only requester or page author can delete
		const page = await pageDal.findById(request.pageId)
		if (request.requesterId !== userId && page?.authorId !== userId) {
			throw new Error('FORBIDDEN')
		}

		return changeRequestDal.delete(id)
	},
}
