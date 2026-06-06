import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { categoryDal } from '../../dal/wiki/categoryDal'
import { categoryService } from '../../services/wiki/categoryService'

export const categoryController = {
	async list(c: Context) {
		try {
			const limit = Math.floor(Number(c.req.query('limit')) || 50)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)
			const result = await categoryDal.list(limit, offset)

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
			console.error('Error listing categories:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to list categories',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getTree(c: Context) {
		try {
			const tree = await categoryService.getTree()

			return c.json<ApiResponse>({
				success: true,
				data: tree,
			})
		} catch (error) {
			console.error('Error getting category tree:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get category tree',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getBySlug(c: Context) {
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

			const result = await categoryService.getCategoryWithPages(slug, limit, offset)

			return c.json<ApiResponse>({
				success: true,
				data: result,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to get category'
			const statusCode =
				message === 'CATEGORY_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
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

			const category = await categoryService.create(body)

			return c.json<ApiResponse>(
				{ success: true, data: category, code: HTTP_STATUS.CREATED },
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create category'
			const statusCode =
				message === 'CATEGORY_EXISTS' ? HTTP_STATUS.CONFLICT : HTTP_STATUS.INTERNAL_SERVER_ERROR
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

			const category = await categoryService.update(slug, body)

			return c.json<ApiResponse>({
				success: true,
				data: category,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to update category'
			const statusCode =
				message === 'CATEGORY_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
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

			await categoryService.delete(slug)

			return c.json<ApiResponse>({
				success: true,
				message: 'Category deleted',
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete category'
			const statusCode =
				message === 'CATEGORY_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async addPage(c: Context) {
		try {
			const slug = c.req.param('slug')
			const body = await c.req.json()
			const { pageId } = body || {}

			if (!slug || !pageId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or pageId', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const category = await categoryDal.findBySlug(slug)
			if (!category) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Category not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			await categoryDal.addPage(pageId, category.id)
			await categoryDal.incrementPageCount(category.id)

			return c.json<ApiResponse>({
				success: true,
				message: 'Page added to category',
			})
		} catch (error) {
			console.error('Error adding page to category:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to add page to category',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async removePage(c: Context) {
		try {
			const slug = c.req.param('slug')
			const pageId = c.req.param('pageId')

			if (!slug || !pageId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or pageId', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const category = await categoryDal.findBySlug(slug)
			if (!category) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Category not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			await categoryDal.removePage(pageId, category.id)
			await categoryDal.decrementPageCount(category.id)

			return c.json<ApiResponse>({
				success: true,
				message: 'Page removed from category',
			})
		} catch (error) {
			console.error('Error removing page from category:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to remove page from category',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},
}
