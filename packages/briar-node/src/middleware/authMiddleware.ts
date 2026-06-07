import { type ApiResponse, HTTP_STATUS } from '@briar/shared'
import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { authService } from '../services/authService'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
	const authHeader = c.req.header('Authorization') || ''
	const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
	const tokenFromCookie = getCookie(c, 'briar_token') || ''
	const token = tokenFromHeader || tokenFromCookie

	if (!token) {
		return c.json<ApiResponse>(
			{
				success: false,
				message: 'Unauthorized',
				code: HTTP_STATUS.UNAUTHORIZED,
			},
			HTTP_STATUS.UNAUTHORIZED,
		)
	}

	let user: { id: string; name: string; email: string; createdAt: Date } | null = null
	try {
		const payload = authService.verifyToken(token)
		user = await authService.getUserById(payload.sub)
	} catch (error) {
		return c.json<ApiResponse>(
			{
				success: false,
				message: 'Unauthorized',
				code: HTTP_STATUS.UNAUTHORIZED,
			},
			HTTP_STATUS.UNAUTHORIZED,
		)
	}

	if (!user) {
		return c.json<ApiResponse>(
			{
				success: false,
				message: 'Unauthorized',
				code: HTTP_STATUS.UNAUTHORIZED,
			},
			HTTP_STATUS.UNAUTHORIZED,
		)
	}

	c.set('user', user)
	await next()
}
