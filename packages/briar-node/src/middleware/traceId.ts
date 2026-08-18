import { generateId } from '@briar/shared'
import type { MiddlewareHandler } from 'hono'
import { runWithTrace } from '../lib/logger'

/**
 * 为每个请求生成唯一 trace-id，写入 context 和响应头；
 * 同时用 AsyncLocalStorage 包住处理链，链上的 console.* 会自动带 [traceId] 前缀
 */
export const traceIdMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		const traceId = generateId()
		c.set('traceId', traceId)
		c.header('X-Trace-Id', traceId)
		return runWithTrace(traceId, () => next())
	}
}
