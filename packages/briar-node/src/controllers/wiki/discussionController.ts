import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { discussionDal } from '../../dal/wiki/discussionDal'
import { discussionService } from '../../services/wiki/discussionService'

export const discussionController = {
	async listTopics(c: Context) {
		try {
			const slug = c.req.param('slug')
			const limit = Math.floor(Number(c.req.query('limit')) || 20)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const result = await discussionService.getTopics(slug, limit, offset)

			return c.json<ApiResponse>({
				success: true,
				data: {
					items: result.items,
					total: result.total,
					limit,
					offset,
				},
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to list topics'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async createTopic(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')
			const body = await c.req.json()

			if (!slug || !body.title) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or title', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const topic = await discussionService.createTopic(slug, body.title, user.id)

			return c.json<ApiResponse>(
				{ success: true, data: topic, code: HTTP_STATUS.CREATED },
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create topic'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async getTopic(c: Context) {
		try {
			const slug = c.req.param('slug')
			const topicId = c.req.param('topicId')

			if (!slug || !topicId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or topicId', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const topic = await discussionDal.findById(topicId)
			if (!topic) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Topic not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			return c.json<ApiResponse>({
				success: true,
				data: topic,
			})
		} catch (error) {
			console.error('Error getting topic:', error)
			return c.json<ApiResponse>(
				{ success: false, message: 'Failed to get topic', code: HTTP_STATUS.INTERNAL_SERVER_ERROR },
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async createReply(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')
			const topicId = c.req.param('topicId')
			const body = await c.req.json()

			if (!slug || !topicId || !body.content) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing slug, topicId, or content',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const reply = await discussionService.createReply(
				slug,
				topicId,
				body.content,
				user.id,
				body.parentReplyId,
			)

			return c.json<ApiResponse>(
				{ success: true, data: reply, code: HTTP_STATUS.CREATED },
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create reply'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'PAGE_NOT_FOUND' || message === 'TOPIC_NOT_FOUND') {
				statusCode = HTTP_STATUS.NOT_FOUND
			}

			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async getReplies(c: Context) {
		try {
			const slug = c.req.param('slug')
			const topicId = c.req.param('topicId')

			if (!slug || !topicId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or topicId', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const replies = await discussionService.getReplies(slug, topicId)

			return c.json<ApiResponse>({
				success: true,
				data: replies,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to get replies'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'PAGE_NOT_FOUND' || message === 'TOPIC_NOT_FOUND') {
				statusCode = HTTP_STATUS.NOT_FOUND
			}

			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async markResolved(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')
			const topicId = c.req.param('topicId')

			if (!slug || !topicId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or topicId', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			await discussionService.markResolved(slug, topicId, user.id)

			return c.json<ApiResponse>({
				success: true,
				message: 'Topic marked as resolved',
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to mark resolved'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'PAGE_NOT_FOUND' || message === 'TOPIC_NOT_FOUND') {
				statusCode = HTTP_STATUS.NOT_FOUND
			}

			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},
}
