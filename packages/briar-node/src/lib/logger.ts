import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * 请求级 trace 上下文 + 日志工具。
 *
 * traceIdMiddleware 用 runWithTrace 包住整个请求处理链，
 * 之后链上所有 console.* 输出都会自动带上 [traceId] 前缀（入口需调用 patchConsoleWithTrace），
 * PM2 日志里 grep 完整 traceId 即可捞出一个请求的全部主动日志。
 */

const storage = new AsyncLocalStorage<{ traceId: string }>()

export const runWithTrace = <T>(traceId: string, fn: () => T): T => storage.run({ traceId }, fn)

export const getTraceId = (): string | undefined => storage.getStore()?.traceId

/** 启动时调用一次：包装 console.*，请求上下文内自动注入 [traceId] 前缀 */
export const patchConsoleWithTrace = () => {
	for (const level of ['log', 'info', 'warn', 'error'] as const) {
		const original = console[level]
		console[level] = (...args: unknown[]) => {
			const traceId = getTraceId()
			if (traceId) {
				original.call(console, `[${traceId}]`, ...args)
			} else {
				original.call(console, ...args)
			}
		}
	}
}

const SENSITIVE_KEY = /token|password|secret|authorization|cookie|credential/i

/** 日志入库前脱敏：递归把敏感字段值替换为 ***（登录响应的 token、登录/注册的密码等） */
export const redactSensitive = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(redactSensitive)
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {}
		for (const [key, v] of Object.entries(value)) {
			out[key] = SENSITIVE_KEY.test(key) ? '***' : redactSensitive(v)
		}
		return out
	}
	return value
}

/** 序列化并截断（默认 2000 字符），避免日志字段过长 */
export const truncateForLog = (value: unknown, max = 2000): string => {
	const str = typeof value === 'string' ? value : (JSON.stringify(value) ?? '')
	return str.length > max ? `${str.slice(0, max)}…[truncated]` : str
}
