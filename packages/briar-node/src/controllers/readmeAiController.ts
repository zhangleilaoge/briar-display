import { type ApiResponse, HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { readmeAiService } from '../services/readmeAiService'

export const readmeAiController = {
	/**
	 * 读取项目的 readme.ai.md
	 * GET /api/readme-ai?projectPath=xxx 或 ?projectName=xxx
	 */
	async read(c: Context) {
		try {
			const projectPath = c.req.query('projectPath')
			const projectName = c.req.query('projectName')

			if (!projectPath && !projectName) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing projectPath or projectName parameter',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const record = projectPath
				? await readmeAiService.getByProjectPath(projectPath)
				: await readmeAiService.getByProjectName(projectName!)

			if (!record) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'NOT_FOUND',
						code: HTTP_STATUS.NOT_FOUND,
					},
					HTTP_STATUS.NOT_FOUND,
				)
			}

			return c.json<ApiResponse>(
				{
					success: true,
					data: record,
					code: HTTP_STATUS.OK,
				},
				HTTP_STATUS.OK,
			)
		} catch (error) {
			console.error('Error reading readme-ai:', error)
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to read readme-ai',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	/**
	 * 初始化项目的 readme.ai.md
	 * POST /api/readme-ai/init
	 */
	async init(c: Context) {
		try {
			const body = await c.req.json()
			const { projectPath, projectName, content, codeHash } = body || {}

			if (!projectPath || !projectName || !content) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing required fields: projectPath, projectName, content',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const record = await readmeAiService.init({
				projectPath,
				projectName,
				content,
				codeHash,
			})

			return c.json<ApiResponse>(
				{
					success: true,
					data: record,
					code: HTTP_STATUS.CREATED,
				},
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to init readme-ai'
			const statusCode =
				message === 'ALREADY_EXISTS' ? HTTP_STATUS.CONFLICT : HTTP_STATUS.INTERNAL_SERVER_ERROR

			return c.json<ApiResponse>(
				{
					success: false,
					message,
					code: statusCode,
				},
				statusCode,
			)
		}
	},

	/**
	 * 重写（更新）项目的 readme.ai.md
	 * POST /api/readme-ai/rewrite
	 */
	async rewrite(c: Context) {
		try {
			const body = await c.req.json()
			const { projectPath, content, codeHash } = body || {}

			if (!projectPath || !content) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing required fields: projectPath, content',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const record = await readmeAiService.rewrite({
				projectPath,
				content,
				codeHash,
			})

			return c.json<ApiResponse>(
				{
					success: true,
					data: record,
					code: HTTP_STATUS.OK,
				},
				HTTP_STATUS.OK,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to rewrite readme-ai'
			const statusCode =
				message === 'NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR

			return c.json<ApiResponse>(
				{
					success: false,
					message,
					code: statusCode,
				},
				statusCode,
			)
		}
	},

	/**
	 * 删除项目的 readme.ai.md
	 * DELETE /api/readme-ai?projectPath=xxx
	 */
	async delete(c: Context) {
		try {
			const projectPath = c.req.query('projectPath')
			if (!projectPath) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: 'Missing projectPath parameter',
						code: HTTP_STATUS.BAD_REQUEST,
					},
					HTTP_STATUS.BAD_REQUEST,
				)
			}

			const success = await readmeAiService.delete(projectPath)

			return c.json<ApiResponse>(
				{
					success: true,
					message: 'Deleted successfully',
					code: HTTP_STATUS.OK,
				},
				HTTP_STATUS.OK,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete readme-ai'
			const statusCode =
				message === 'NOT_FOUND' ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR

			return c.json<ApiResponse>(
				{
					success: false,
					message,
					code: statusCode,
				},
				statusCode,
			)
		}
	},
}
