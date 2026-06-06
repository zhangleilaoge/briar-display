import type { ApiResponse, WikiNamespace, WikiPageStatus } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { backlinkDal } from '../../dal/wiki/backlinkDal'
import { categoryDal } from '../../dal/wiki/categoryDal'
import { pageDal } from '../../dal/wiki/pageDal'
import { tagDal } from '../../dal/wiki/tagDal'
import { pageService } from '../../services/wiki/pageService'

export const pageController = {
	async list(c: Context) {
		try {
			const limit = Math.floor(Number(c.req.query('limit')) || 20)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)
			const namespace = c.req.query('namespace') as WikiNamespace | undefined
			const status = c.req.query('status') as WikiPageStatus | undefined
			const user = c.get('user')

			const result = await pageService.list({ limit, offset, namespace, status, userId: user?.id })

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
			console.error('Error listing pages:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to list pages',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async search(c: Context) {
		try {
			const query = c.req.query('q')
			if (!query) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing search query parameter "q"',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const limit = Math.floor(Number(c.req.query('limit')) || 20)
			const offset = Math.floor(Number(c.req.query('offset')) || 0)
			const user = c.get('user')

			const result = await pageService.search(query, limit, offset, user?.id)

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
			console.error('Error searching pages:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to search pages',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getBySlug(c: Context) {
		try {
			const namespace = c.req.param('namespace') || 'main'
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const page = await pageService.getBySlug(namespace, slug)
			if (!page) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Page not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			// Check visibility: private pages only accessible by author
			if (page.visibility === 'private') {
				const user = c.get('user')
				if (!user || user.id !== page.authorId) {
					return c.json<ApiResponse>(
						{ success: false, message: 'Page not found', code: HTTP_STATUS.NOT_FOUND },
						HTTP_STATUS.NOT_FOUND,
					)
				}
			}

			// Increment view count
			await pageDal.incrementViewCount(page.id)

			return c.json<ApiResponse>({
				success: true,
				data: page,
			})
		} catch (error) {
			console.error('Error getting page:', error)
			return c.json<ApiResponse>(
				{ success: false, message: 'Failed to get page', code: HTTP_STATUS.INTERNAL_SERVER_ERROR },
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getDetails(c: Context) {
		try {
			const namespace = c.req.param('namespace') || 'main'
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const page = await pageService.getBySlug(namespace, slug)
			if (!page) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Page not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			// Check visibility
			if (page.visibility === 'private') {
				const user = c.get('user')
				if (!user || user.id !== page.authorId) {
					return c.json<ApiResponse>(
						{ success: false, message: 'Page not found', code: HTTP_STATUS.NOT_FOUND },
						HTTP_STATUS.NOT_FOUND,
					)
				}
			}

			// Fetch related data
			const [categories, tags, backlinksResult, subpagesResult] = await Promise.all([
				categoryDal.getPageCategories(page.id),
				tagDal.listByPageId(page.id),
				backlinkDal.findByTargetPage(page.id),
				pageDal.list({ limit: 100, offset: 0, namespace: page.namespace }),
			])

			const childPages = subpagesResult.items.filter((p) => p.parentId === page.id)

			return c.json<ApiResponse>({
				success: true,
				data: {
					...page,
					categories,
					tags,
					backlinks: backlinksResult.items,
					subpages: childPages,
				},
			})
		} catch (error) {
			console.error('Error getting page details:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get page details',
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

			if (!body.title || !body.content) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing required fields: title, content',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const page = await pageService.create(body, user.id)

			return c.json<ApiResponse>(
				{ success: true, data: page, code: HTTP_STATUS.CREATED },
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			console.error('Error creating page:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to create page',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async update(c: Context) {
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

			// Optimistic locking: check if page was modified since client last read
			if (body.lastReadAt) {
				const page = await pageDal.findBySlug('main', slug)
				if (page && new Date(page.updatedAt).getTime() > new Date(body.lastReadAt).getTime()) {
					return c.json<ApiResponse>(
						{
							success: false,
							message: '编辑冲突：此页面在你编辑期间已被修改，请刷新后重试',
							code: HTTP_STATUS.CONFLICT,
						},
						HTTP_STATUS.CONFLICT,
					)
				}
			}

			const page = await pageService.update(slug, body, user.id)

			return c.json<ApiResponse>({
				success: true,
				data: page,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to update page'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR

			if (message === 'PAGE_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND
			else if (message === 'FORBIDDEN') statusCode = HTTP_STATUS.FORBIDDEN

			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async delete(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			await pageService.delete(slug, user.id)

			return c.json<ApiResponse>({
				success: true,
				message: 'Page deleted',
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete page'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR

			if (message === 'PAGE_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND
			else if (message === 'FORBIDDEN') statusCode = HTTP_STATUS.FORBIDDEN

			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async getRedirects(c: Context) {
		try {
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const redirects = await pageDal.findRedirects(slug)

			return c.json<ApiResponse>({
				success: true,
				data: redirects,
			})
		} catch (error) {
			console.error('Error getting redirects:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get redirects',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getBacklinks(c: Context) {
		try {
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const page = await pageDal.findBySlug('main', slug)
			if (!page) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Page not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			const result = await backlinkDal.findByTargetPage(page.id)
			return c.json<ApiResponse>({
				success: true,
				data: {
					items: result.items,
					total: result.total,
					limit: 50,
					offset: 0,
				},
			})
		} catch (error) {
			console.error('Error getting backlinks:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get backlinks',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getSubpages(c: Context) {
		try {
			const slug = c.req.param('slug')

			if (!slug) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const page = await pageDal.findBySlug('main', slug)
			if (!page) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Page not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			const result = await pageService.getSubpages(page.id)
			return c.json<ApiResponse>({
				success: true,
				data: {
					items: result.items,
					total: result.total,
					limit: 20,
					offset: 0,
				},
			})
		} catch (error) {
			console.error('Error getting subpages:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get subpages',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},
}
