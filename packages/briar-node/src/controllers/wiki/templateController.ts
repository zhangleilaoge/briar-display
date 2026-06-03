import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { templateService } from '../../services/wiki/templateService'

export const templateController = {
	async list(c: Context) {
		try {
			const limit = Math.floor(Number(c.req.query('limit')) || 20)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)

			const result = await templateService.list(limit, offset)

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
			console.error('Error listing templates:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to list templates',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getBySlug(c: Context) {
		try {
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const template = await templateService.getBySlug(slug)
			if (!template) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Template not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			return c.json<ApiResponse>({
				success: true,
				data: template,
			})
		} catch (error) {
			console.error('Error getting template:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get template',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async create(c: Context) {
		try {
			const user = c.get('user')
			const body = await c.req.json()

			if (!body.name || !body.content) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing required fields: name, content',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const template = await templateService.create(body, user.id)

			return c.json<ApiResponse>(
				{ success: true, data: template, code: HTTP_STATUS.CREATED },
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create template'
			const statusCode =
				message === 'TEMPLATE_EXISTS' ? HTTP_STATUS.CONFLICT : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async update(c: Context) {
		try {
			const slug = c.req.param('slug')
			const body = await c.req.json()

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const template = await templateService.update(slug, body)

			return c.json<ApiResponse>({
				success: true,
				data: template,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to update template'
			const statusCode =
				message === 'TEMPLATE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async delete(c: Context) {
		try {
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			await templateService.delete(slug)

			return c.json<ApiResponse>({
				success: true,
				message: 'Template deleted',
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete template'
			const statusCode =
				message === 'TEMPLATE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},
}
