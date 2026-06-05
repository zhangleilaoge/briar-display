import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { tagService } from '../../services/wiki/tagService'

export const tagController = {
	async list(c: Context) {
		try {
			const tags = await tagService.list()
			return c.json<ApiResponse>({ success: true, data: tags })
		} catch (error) {
			console.error('Error listing tags:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to list tags',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async create(c: Context) {
		try {
			const body = await c.req.json()

			if (!body.name) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing required field: name',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const tag = await tagService.create(body)

			return c.json<ApiResponse>(
				{ success: true, data: tag, code: HTTP_STATUS.CREATED },
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create tag'
			const statusCode =
				message === 'TAG_EXISTS' ? HTTP_STATUS.CONFLICT : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
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

			const tag = await tagService.getBySlug(slug)
			return c.json<ApiResponse>({ success: true, data: tag })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to get tag'
			const statusCode =
				message === 'TAG_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async delete(c: Context) {
		try {
			const id = c.req.param('id')

			if (!id) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing id', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			await tagService.delete(id)

			return c.json<ApiResponse>({ success: true, message: 'Tag deleted' })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete tag'
			const statusCode =
				message === 'TAG_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},
}
