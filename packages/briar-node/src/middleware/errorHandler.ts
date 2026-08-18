import { type ApiResponse, HTTP_STATUS } from '@briar/shared'
import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logDal } from '../dal/logDal'
import { redactSensitive, truncateForLog } from '../lib/logger'

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
			// console 已被 patchConsoleWithTrace 包装，请求上下文内自动带 [traceId] 前缀
			console.error('🔴 Unhandled error:', error)

			// 写入数据库（耗时/堆栈由 loggerMiddleware 抛出前捎到 context；无则现场取）
			if (traceId) {
				logDal
					.create({
						traceId,
						method: c.req.method,
						path: c.req.path,
						status: error instanceof HTTPException ? error.status : 500,
						duration: (c.get('logDuration') as number | undefined) ?? 0,
						ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || undefined,
						userAgent: c.req.header('user-agent') || undefined,
						userId: (c.get('user') as { id: string } | undefined)?.id,
						responseBody: truncateForLog(redactSensitive({ success: false, message: errorMsg })),
						errorMessage: errorMsg,
						errorStack:
							(c.get('logErrorStack') as string | undefined) ??
							(error instanceof Error ? error.stack : undefined),
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
