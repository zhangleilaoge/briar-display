import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { watchlistService } from '../../services/wiki/watchlistService'

export const watchlistController = {
	async list(c: Context) {
		try {
			const user = c.get('user')
			const limit = Math.floor(Number(c.req.query('limit')) || 20)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			const result = await watchlistService.listByUser(user.id, limit, offset)

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
			console.error('Error listing watchlist:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to list watchlist',
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

			const result = await watchlistService.add(slug, user.id)

			return c.json<ApiResponse>({
				success: true,
				data: result,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to add to watchlist'
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

			const result = await watchlistService.remove(slug, user.id)

			return c.json<ApiResponse>({
				success: true,
				data: result,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to remove from watchlist'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async isWatching(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const watching = await watchlistService.isWatching(slug, user.id)

			return c.json<ApiResponse>({
				success: true,
				data: { watching },
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to check watchlist'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},
}
