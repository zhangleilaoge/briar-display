import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { inlineCommentService } from '../../services/wiki/inlineCommentService'

export const inlineCommentController = {
	async list(c: Context) {
		try {
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const comments = await inlineCommentService.listByPage(slug)
			return c.json<ApiResponse>({ success: true, data: comments })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to list inline comments'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async listByAnchor(c: Context) {
		try {
			const slug = c.req.param('slug')
			const anchor = c.req.param('anchor')

			if (!slug || !anchor) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or anchor', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const comments = await inlineCommentService.listByAnchor(slug, anchor)
			return c.json<ApiResponse>({ success: true, data: comments })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to list inline comments'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async create(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')
			const body = await c.req.json()

			if (!slug || !body.anchor || !body.content) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing required fields: slug, anchor, content',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const comment = await inlineCommentService.create(
				slug,
				{ anchor: body.anchor, content: body.content },
				user.id,
			)
			return c.json<ApiResponse>(
				{ success: true, data: comment, code: HTTP_STATUS.CREATED },
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create inline comment'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async update(c: Context) {
		try {
			const user = c.get('user')
			const id = c.req.param('id')
			const body = await c.req.json()

			if (!id) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing id', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const comment = await inlineCommentService.update(id, body, user.id)
			return c.json<ApiResponse>({ success: true, data: comment })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to update inline comment'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'COMMENT_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND
			else if (message === 'FORBIDDEN') statusCode = HTTP_STATUS.FORBIDDEN
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async delete(c: Context) {
		try {
			const user = c.get('user')
			const id = c.req.param('id')

			if (!id) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing id', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			await inlineCommentService.delete(id, user.id)
			return c.json<ApiResponse>({ success: true, message: 'Comment deleted' })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete inline comment'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'COMMENT_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND
			else if (message === 'FORBIDDEN') statusCode = HTTP_STATUS.FORBIDDEN
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},
}
