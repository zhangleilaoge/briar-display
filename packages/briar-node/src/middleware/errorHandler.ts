import { type ApiResponse, HTTP_STATUS } from '@briar/shared'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logDal } from '../dal/logDal'

/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误并返回统一格式的 JSON 响应
 */
export const errorHandler = (): MiddlewareHandler => {
	return async (c: Context, next) => {
		try {
			await next()
		} catch (error) {
			const traceId = c.get('traceId') as string | undefined
			const errorMsg = error instanceof Error ? error.message : String(error)
			console.error(`🔴 Unhandled error [${traceId || 'no-trace'}]:`, error)

			// 写入数据库
			if (traceId) {
				logDal
					.create({
						traceId,
						method: c.req.method,
						path: c.req.path,
						status: error instanceof HTTPException ? error.status : 500,
						duration: 0,
						ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || undefined,
						userAgent: c.req.header('user-agent') || undefined,
						userId: (c.get('user') as { id: string } | undefined)?.id,
						errorMessage: errorMsg,
					})
					.catch(() => {})
			}

			// 处理 Hono HTTPException
			if (error instanceof HTTPException) {
				return c.json<ApiResponse>(
					{
						success: false,
						message: error.message,
						code: error.status,
					},
					error.status,
				)
			}

			// 处理标准 Error
			if (error instanceof Error) {
				const isDev = process.env.NODE_ENV !== 'production'
				return c.json<ApiResponse>(
					{
						success: false,
						message: error.message,
						code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
						...(isDev && { stack: error.stack }),
					},
					HTTP_STATUS.INTERNAL_SERVER_ERROR,
				)
			}

			// 处理未知错误
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Internal server error',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	}
}
