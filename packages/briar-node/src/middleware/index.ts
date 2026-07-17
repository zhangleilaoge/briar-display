import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { cors } from 'hono/cors'
import { isApiPublicPath } from '../config/routes'
import { logDal } from '../dal/logDal'
import { authService } from '../services/authService'
import { authMiddleware } from './authMiddleware'
import { errorHandler } from './errorHandler'

/**
 * 格式化日志输出
 */
const formatLog = (
	method: string,
	path: string,
	status: number,
	time: string,
	traceId?: string,
	params?: any,
	response?: any,
) => {
	const statusColor =
		status >= 500
			? '\x1b[31m' // 红色
			: status >= 400
				? '\x1b[33m' // 黄色
				: status >= 300
					? '\x1b[36m' // 青色
					: '\x1b[32m' // 绿色
	const reset = '\x1b[0m'
	const dim = '\x1b[2m'
	const bold = '\x1b[1m'

	let log = `${dim}-->${reset} ${bold}${method}${reset} ${path} ${statusColor}${status}${reset} ${time}`
	if (traceId) {
		log += ` ${dim}[${traceId.slice(0, 8)}]${reset}`
	}

	// 添加请求参数
	if (params && Object.keys(params).length > 0) {
		log += `\n   ${dim}📥 入参:${reset} ${JSON.stringify(params)}`
	}

	// 添加响应数据
	if (response !== undefined) {
		const responseStr =
			typeof response === 'string' ? response : JSON.stringify(response).slice(0, 500) // 限制长度避免日志过长
		log += `\n   ${dim}📤 出参:${reset} ${responseStr}`
	}

	return log
}

/**
 * 全局日志中间件 - 增强版，API 请求包含请求和响应参数
 */
export const loggerMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		const start = Date.now()
		const method = c.req.method
		const path = c.req.path
		const isApiRequest = path.startsWith('/api')
		const traceId = c.get('traceId') as string | undefined

		let params: Record<string, unknown> = {}
		let responseData: any
		let errorMessage: string | undefined

		// 只有 API 请求才收集详细参数
		if (isApiRequest) {
			// 收集请求参数
			const queryParams = c.req.query()
			let bodyParams: Record<string, unknown> = {}

			// 如果是 POST/PUT/PATCH 请求，尝试获取 body
			if (['POST', 'PUT', 'PATCH'].includes(method)) {
				try {
					// 克隆请求以避免消费原始请求体
					const clonedReq = c.req.raw.clone()
					const contentType = c.req.header('content-type')

					if (contentType?.includes('application/json')) {
						bodyParams = (await clonedReq.json()) as Record<string, unknown>
					} else if (contentType?.includes('application/x-www-form-urlencoded')) {
						const formData = await clonedReq.formData()
						bodyParams = Object.fromEntries(formData)
					}
				} catch (e) {
					// 忽略解析错误
				}
			}

			params = {
				...queryParams,
				...bodyParams,
			}
		}

		try {
			await next()
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err)
			throw err
		}

		const end = Date.now()
		const duration = end - start
		const time = `${duration}ms`
		const status = c.res.status

		// 只有 API 请求才获取响应数据
		if (isApiRequest) {
			try {
				const clonedRes = c.res.clone()
				const contentType = clonedRes.headers.get('content-type')

				if (contentType?.includes('application/json')) {
					responseData = await clonedRes.json()
					// 从响应中提取错误信息
					if (status >= 400 && responseData?.message) {
						errorMessage = responseData.message
					}
				} else if (contentType?.includes('text')) {
					const text = await clonedRes.text()
					responseData = text.length > 200 ? `${text.slice(0, 200)}...` : text
				}
			} catch (e) {
				// 忽略解析错误
			}
		}

		console.log(
			formatLog(
				method,
				path,
				status,
				time,
				traceId,
				isApiRequest ? params : undefined,
				isApiRequest ? responseData : undefined,
			),
		)

		// API 请求写入数据库（异步，不阻塞响应）
		if (isApiRequest && traceId) {
			const user = c.get('user') as { id: string } | undefined
			logDal
				.create({
					traceId,
					method,
					path,
					status,
					duration,
					ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || undefined,
					userAgent: c.req.header('user-agent') || undefined,
					userId: user?.id,
					requestParams: Object.keys(params).length > 0 ? params : undefined,
					errorMessage,
				})
				.catch((err) => {
					console.error('Failed to write request log:', err)
				})
		}
	}
}

/**
 * CORS 中间件配置
 */
export const corsMiddleware = (): MiddlewareHandler =>
	cors({
		origin: '*',
		allowHeaders: ['Content-Type', 'Authorization'],
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	})

/**
 * 前端页面认证中间件
 * 检查 cookie 中的 token，并验证其有效性（防伪造 cookie）。
 * 未登录或 token 无效/过期 → 重定向到登录页。
 *
 * 注意：浏览器直接导航 GET HTML 时不带 Authorization header，
 * 只能依赖 cookie（登录时由前端 setAuthToken 写入）。
 * API 请求由 authMiddleware 单独校验（Authorization header 或 cookie 都可）。
 */
export const pageAuthMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		const token = getCookie(c, 'briar_token')
		if (!token) {
			return c.redirect('/briar-display/login')
		}

		// 真正校验 token 签名 + 过期时间，防止伪造 cookie
		try {
			const payload = authService.verifyToken(token)
			// 可选：进一步校验用户是否仍存在
			const user = await authService.getUserById(payload.sub)
			if (!user) {
				return c.redirect('/briar-display/login')
			}
		} catch {
			// token 无效/过期/签名错误 → 清掉 cookie 并重定向
			c.header('Set-Cookie', 'briar_token=; Path=/; Max-Age=0')
			return c.redirect('/briar-display/login')
		}

		return next()
	}
}

/**
 * API 认证中间件包装器
 * 根据路径配置决定是否需要认证
 */
export const apiAuthMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		const pathname = c.req.path

		// 公开 API 路径不需要认证
		if (isApiPublicPath(pathname)) {
			return next()
		}

		// 需要认证的路径使用 authMiddleware
		return authMiddleware(c, next)
	}
}

export { authMiddleware, errorHandler }
