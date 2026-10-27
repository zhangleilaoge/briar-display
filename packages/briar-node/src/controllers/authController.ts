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
					message: !email ? '请输入邮箱' : '请输入密码',
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
			let message = '登录失败，请稍后再试'
			if (error instanceof Error) {
				if (error.message === 'USER_NOT_FOUND') {
					message = '该邮箱尚未注册'
				} else if (error.message === 'INVALID_PASSWORD') {
					message = '密码错误，请重新输入'
				}
			}
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

	/**
	 * POST /auth/google/id-token — GIS 登录：body { credential }，本地验签后关联/创建用户，
	 * 返回与邮箱登录一致的 { user, token, permissions }
	 */
	async googleIdToken(c: Context) {
		if (!authService.isGoogleConfigured()) {
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Google 登录未配置（缺少 BRIAR_GOOGLE_CLIENT_ID）',
					code: HTTP_STATUS.SERVICE_UNAVAILABLE,
				},
				HTTP_STATUS.SERVICE_UNAVAILABLE,
			)
		}

		const body = await c.req.json().catch(() => null)
		const credential = typeof body?.credential === 'string' ? body.credential : ''
		if (!credential) {
			return c.json<ApiResponse>(
				{ success: false, message: '缺少 Google 凭证', code: HTTP_STATUS.BAD_REQUEST },
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		try {
			const profile = await authService.verifyGoogleCredential(credential)
			const result = await authService.loginWithGoogle(profile)
			return c.json<ApiResponse>({ success: true, data: result, code: HTTP_STATUS.OK })
		} catch (err) {
			const codeName = err instanceof Error ? err.message : 'UNKNOWN'
			const map: Record<string, string> = {
				GOOGLE_ID_TOKEN_INVALID: 'Google 凭证无效，请重试',
				GOOGLE_ID_TOKEN_EXPIRED: 'Google 凭证已过期，请重试',
				GOOGLE_JWKS_UNAVAILABLE: '服务器暂无 Google 公钥，请稍后再试',
				GOOGLE_PROFILE_INCOMPLETE: 'Google 账号缺少邮箱',
				GOOGLE_EMAIL_UNVERIFIED: '请先在 Google 验证该邮箱',
				GOOGLE_NOT_CONFIGURED: 'Google 登录未配置',
			}
			const known = codeName in map
			if (!known) console.error('Google ID token login failed:', err)
			return c.json<ApiResponse>(
				{
					success: false,
					message: map[codeName] || 'Google 登录失败，请稍后再试',
					code: known ? HTTP_STATUS.UNAUTHORIZED : HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				known ? HTTP_STATUS.UNAUTHORIZED : HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},
}
