import { type ApiResponse, HTTP_STATUS } from '@briar/shared'
import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { authService } from '../services/authService'

/** 滑动续期响应头：token 剩余有效期过半时，响应头带新 token，前端拦截器就地替换 */
export const REFRESHED_TOKEN_HEADER = 'x-auth-token'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
	const authHeader = c.req.header('Authorization') || ''
	const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
	const tokenFromCookie = getCookie(c, 'briar_token') || ''
	const token = tokenFromHeader || tokenFromCookie

	const unauthorized = () =>
		c.json<ApiResponse>(
			{
				success: false,
				message: 'Unauthorized',
				code: HTTP_STATUS.UNAUTHORIZED,
			},
			HTTP_STATUS.UNAUTHORIZED,
		)

	if (!token) {
		return unauthorized()
	}

	// JWT 签名 + 用户存在 + token_version 匹配（改密码后旧 token 立即失效）
	const auth = await authService.verifyLoginToken(token)
	if (!auth) {
		return unauthorized()
	}

	const refreshed = authService.maybeRefreshLoginToken(auth.payload, auth.user)
	if (refreshed) {
		c.header(REFRESHED_TOKEN_HEADER, refreshed)
	}

	// 只暴露公开字段，passwordHash 等不进请求上下文
	c.set('user', {
		id: auth.user.id,
		name: auth.user.name,
		email: auth.user.email,
		createdAt: auth.user.createdAt,
	})
	await next()
}
