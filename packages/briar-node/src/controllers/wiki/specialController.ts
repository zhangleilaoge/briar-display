import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { specialService } from '../../services/wiki/specialService'

export const specialController = {
	async recentChanges(c: Context) {
		try {
			const limit = Math.floor(Number(c.req.query('limit')) || 50)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			const result = await specialService.recentChanges(limit, offset)

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
			console.error('Error getting recent changes:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get recent changes',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async statistics(c: Context) {
		try {
			const stats = await specialService.statistics()

			return c.json<ApiResponse>({
				success: true,
				data: stats,
			})
		} catch (error) {
			console.error('Error getting statistics:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get statistics',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async allPages(c: Context) {
		try {
			const namespace = c.req.query('namespace')
			const limit = Math.floor(Number(c.req.query('limit')) || 50)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			const result = await specialService.allPages(namespace || undefined, limit, offset)

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
			console.error('Error getting all pages:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get all pages',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async orphanedPages(c: Context) {
		try {
			const limit = Math.floor(Number(c.req.query('limit')) || 50)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			const result = await specialService.orphanedPages(limit, offset)

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
			console.error('Error getting orphaned pages:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get orphaned pages',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async wantedPages(c: Context) {
		try {
			const limit = Math.floor(Number(c.req.query('limit')) || 50)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			const result = await specialService.wantedPages(limit, offset)

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
			console.error('Error getting wanted pages:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get wanted pages',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async userContributions(c: Context) {
		try {
			const userId = c.req.param('userId')
			const limit = Math.floor(Number(c.req.query('limit')) || 50)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			if (!userId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing userId', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const result = await specialService.userContributions(userId, limit, offset)

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
			console.error('Error getting user contributions:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get user contributions',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},
}
