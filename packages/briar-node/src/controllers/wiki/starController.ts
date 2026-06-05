import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { starService } from '../../services/wiki/starService'

export const starController = {
	async list(c: Context) {
		try {
			const user = c.get('user')
			const limit = Math.floor(Number(c.req.query('limit')) || 50)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			const result = await starService.listByUser(user.id, limit, offset)

			return c.json<ApiResponse>({
				success: true,
				data: result,
			})
		} catch (error) {
			console.error('Error listing stars:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to list stars',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async add(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const result = await starService.add(user.id, slug)
			return c.json<ApiResponse>({ success: true, data: result })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to star page'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async remove(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const result = await starService.remove(user.id, slug)
			return c.json<ApiResponse>({ success: true, data: result })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to unstar page'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async isStarred(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const starred = await starService.isStarred(user.id, slug)
			return c.json<ApiResponse>({ success: true, data: { starred } })
		} catch (error) {
			console.error('Error checking star status:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to check star status',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},
}
