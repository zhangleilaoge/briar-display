import { generateId } from '@briar/shared'
import type { MiddlewareHandler } from 'hono'

/**
 * 为每个请求生成唯一 trace-id，写入 context 和响应头
 */
export const traceIdMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		const traceId = generateId()
		c.set('traceId', traceId)
		c.header('X-Trace-Id', traceId)
		await next()
	}
}
