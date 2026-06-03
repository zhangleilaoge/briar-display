import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { pageDal } from '../../dal/wiki/pageDal'
import { revisionDal } from '../../dal/wiki/revisionDal'
import { revisionService } from '../../services/wiki/revisionService'

export const revisionController = {
	async list(c: Context) {
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

			const result = await revisionService.getRevisions(slug, limit, offset)

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
			const message = error instanceof Error ? error.message : 'Failed to list revisions'
			const statusCode =
				message === 'PAGE_NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR
			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async getById(c: Context) {
		try {
			const slug = c.req.param('slug')
			const revId = c.req.param('revId')

			if (!slug || !revId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or revision ID', code: HTTP_STATUS.BAD_REQUEST },
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

			const revision = await revisionDal.findById(revId)
			if (!revision || revision.pageId !== page.id) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Revision not found', code: HTTP_STATUS.NOT_FOUND },
					HTTP_STATUS.NOT_FOUND,
				)
			}

			return c.json<ApiResponse>({
				success: true,
				data: revision,
			})
		} catch (error) {
			console.error('Error getting revision:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to get revision',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async getDiff(c: Context) {
		try {
			const slug = c.req.param('slug')
			const from = Number(c.req.query('from'))
			const to = Number(c.req.query('to'))

			if (!slug || Number.isNaN(from) || Number.isNaN(to)) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing slug, from, or to parameters',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const diff = await revisionService.getDiff(slug, from, to)

			return c.json<ApiResponse>({
				success: true,
				data: diff,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to get diff'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'PAGE_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND
			else if (message === 'REVISION_NOT_FOUND') statusCode = HTTP_STATUS.NOT_FOUND

			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},

	async revert(c: Context) {
		try {
			const user = c.get('user')
			const slug = c.req.param('slug')
			const revId = c.req.param('revId')

			if (!slug || !revId) {
				return c.json<ApiResponse>(
					{ success: false, message: 'Missing slug or revision ID', code: HTTP_STATUS.BAD_REQUEST },
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const revision = await revisionService.revertToRevision(slug, revId, user.id)

			return c.json<ApiResponse>({
				success: true,
				data: revision,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to revert'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] =
				HTTP_STATUS.INTERNAL_SERVER_ERROR
			if (message === 'PAGE_NOT_FOUND' || message === 'REVISION_NOT_FOUND') {
				statusCode = HTTP_STATUS.NOT_FOUND
			}

			return c.json<ApiResponse>({ success: false, message, code: statusCode }, statusCode)
		}
	},
}
