import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { logDal } from '../dal/logDal'

export const logController = {
	async getByTraceId(c: Context) {
		try {
			const traceId = c.req.param('traceId')

			if (!traceId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing traceId', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const logs = await logDal.findByTraceId(traceId)
			return c.json<ApiResponse>({ success: true, data: logs })
		} catch (error) {
			console.error('Error fetching logs:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to fetch logs',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getSlowRequests(c: Context) {
		try {
			const limit = Math.max(1, Math.floor(Number(c.req.query('limit')) || 20))
			const logs = await logDal.findSlowRequests(limit)
			return c.json<ApiResponse>({ success: true, data: logs })
		} catch (error) {
			console.error('Error fetching slow requests:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to fetch logs',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getErrors(c: Context) {
		try {
			const limit = Math.max(1, Math.floor(Number(c.req.query('limit')) || 20))
			const logs = await logDal.findErrors(limit)
			return c.json<ApiResponse>({ success: true, data: logs })
		} catch (error) {
			console.error('Error fetching error logs:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to fetch logs',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},
}
