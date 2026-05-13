import { type ApiResponse, HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { authService } from '../services/authService'

export const authController = {
	async register(c: Context) {
		const body = await c.req.json()
		const { name, email, password } = body || {}

		if (!name || !email || !password) {
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Missing required fields',
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		try {
			const result = await authService.register(name, email, password)
			return c.json<ApiResponse>(
				{
					success: true,
					data: result,
					code: HTTP_STATUS.CREATED,
				},
				HTTP_STATUS.CREATED,
			)
		} catch (error) {
			const message =
				error instanceof Error && error.message === 'EMAIL_EXISTS'
					? 'Email already exists'
					: 'Register failed'
			return c.json<ApiResponse>(
				{
					success: false,
					message,
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}
	},

	async login(c: Context) {
		const body = await c.req.json()
		const { email, password } = body || {}

		if (!email || !password) {
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Missing required fields',
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		try {
			const result = await authService.login(email, password)
			return c.json<ApiResponse>({
				success: true,
				data: result,
				code: HTTP_STATUS.OK,
			})
		} catch (error) {
			const message =
				error instanceof Error && error.message === 'INVALID_CREDENTIALS'
					? 'Invalid credentials'
					: 'Login failed'
			return c.json<ApiResponse>(
				{
					success: false,
					message,
					code: HTTP_STATUS.UNAUTHORIZED,
				},
				HTTP_STATUS.UNAUTHORIZED,
			)
		}
	},

	async sendPasswordResetCode(c: Context) {
		const body = await c.req.json()
		const { email } = body || {}

		if (!email) {
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Missing email',
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		try {
			await authService.sendPasswordResetCode(email)
			return c.json<ApiResponse>({
				success: true,
				message: 'Reset code sent to your email',
				code: HTTP_STATUS.OK,
			})
		} catch (error) {
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Failed to send reset code',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},

	async resetPassword(c: Context) {
		const body = await c.req.json()
		const { email, code, newPassword } = body || {}

		if (!email || !code || !newPassword) {
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Missing required fields',
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		try {
			const result = await authService.resetPassword(email, code, newPassword)
			return c.json<ApiResponse>({
				success: true,
				data: result,
				code: HTTP_STATUS.OK,
			})
		} catch (error) {
			let message = 'Password reset failed'
			let statusCode: (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS] = HTTP_STATUS.BAD_REQUEST

			if (error instanceof Error) {
				if (error.message === 'INVALID_CODE') {
					message = 'Invalid or expired reset code'
				} else if (error.message === 'USER_NOT_FOUND') {
					message = 'User not found'
					statusCode = HTTP_STATUS.NOT_FOUND
				}
			}

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
