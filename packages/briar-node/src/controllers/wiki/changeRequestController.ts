import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { changeRequestService } from '../../services/wiki/changeRequestService'

export const changeRequestController = {
	async listByPage(c: Context) {
		try {
			const slug = c.req.param('slug')
			const status = c.req.query('status') as any
			const limit = Math.floor(Number(c.req.query('limit')) || 20)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const result = await changeRequestService.listByPage(slug, status, limit, offset)
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
			const message = error instanceof Error ? error.message : 'Failed to list change requests'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async listByRequester(c: Context) {
		try {
			const user = c.get('user')
			const limit = Math.floor(Number(c.req.query('limit')) || 20)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)
			const result = await changeRequestService.listByRequester(user.id, limit, offset)
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
			console.error('Error listing change requests:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to list change requests',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async create(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')
			const body = await c.req.json()

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const request = await changeRequestService.create(slug, body, user.id)
			return c.json<ApiResponse>(
				{ success: true, data: request, code: HTTP_STATUS.CREATED },
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create change request'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'PAGE_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND
			else if (message === 'AUTHOR_NO_REQUEST') {
				statusCode = HTTP_STATUS.BAD_REQUEST
			}
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async review(c: Context) {
		try {
			const user = c.get('user')
			const id = c.req.param('id')
			const body = await c.req.json()

			if (!id || !body.status) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing id or status',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			if (body.status !== 'approved' && body.status !== 'rejected') {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Invalid status, must be approved or rejected',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const request = await changeRequestService.review(id, body.status, user.id, body.comment)
			return c.json<ApiResponse>({ success: true, data: request })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to review change request'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'REQUEST_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND
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

			await changeRequestService.delete(id, user.id)
			return c.json<ApiResponse>({ success: true, message: 'Change request deleted' })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete change request'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'REQUEST_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND
			else if (message === 'FORBIDDEN') statusCode = HTTP_STATUS.FORBIDDEN
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},
}
