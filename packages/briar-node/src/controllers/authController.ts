import { type ApiResponse, HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { authService, sanitizeLoginRedirect } from '../services/authService'

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

	/** GET /auth/google — 跳转 Google 授权页 */
	async googleStart(c: Context) {
		if (!authService.isGoogleConfigured()) {
			return c.json<ApiResponse>(
				{
					success: false,
					message: 'Google 登录未配置（缺少 BRIAR_GOOGLE_CLIENT_ID / SECRET）',
					code: HTTP_STATUS.SERVICE_UNAVAILABLE,
				},
				HTTP_STATUS.SERVICE_UNAVAILABLE,
			)
		}

		const redirect = sanitizeLoginRedirect(c.req.query('redirect'))
		const state = authService.createGoogleOAuthState(redirect)
		const url = authService.buildGoogleAuthorizeUrl(state)
		return c.redirect(url)
	},

	/**
	 * GET /auth/google/callback — Google 回调：换 token、关联/创建用户、跳回前端落地页写入 JWT
	 */
	async googleCallback(c: Context) {
		const fail = (message: string) => {
			const q = new URLSearchParams({ error: message })
			return c.redirect(`/briar/auth/callback?${q.toString()}`)
		}

		if (!authService.isGoogleConfigured()) {
			return fail('Google 登录未配置')
		}

		const error = c.req.query('error')
		if (error) {
			return fail(error === 'access_denied' ? '你取消了 Google 授权' : `Google 授权失败：${error}`)
		}

		const code = c.req.query('code')
		const state = c.req.query('state')
		if (!code || !state) {
			return fail('缺少授权参数')
		}

		let redirectPath = '/briar/'
		try {
			const st = authService.verifyGoogleOAuthState(state)
			redirectPath = sanitizeLoginRedirect(st.r)
		} catch {
			return fail('登录状态已过期，请重试')
		}

		try {
			const profile = await authService.fetchGoogleProfile(code)
			const result = await authService.loginWithGoogle(profile)
			const q = new URLSearchParams({
				token: result.token,
				redirect: redirectPath,
			})
			// 同步写 cookie，页面中间件与后续导航立即可用
			c.header('Set-Cookie', `briar_token=${result.token}; Path=/; Max-Age=604800; SameSite=Lax`)
			return c.redirect(`/briar/auth/callback?${q.toString()}`)
		} catch (err) {
			const codeName = err instanceof Error ? err.message : 'UNKNOWN'
			const map: Record<string, string> = {
				GOOGLE_TOKEN_FAILED: 'Google 令牌交换失败',
				GOOGLE_USERINFO_FAILED: '获取 Google 用户信息失败',
				GOOGLE_PROFILE_INCOMPLETE: 'Google 账号缺少邮箱',
				GOOGLE_EMAIL_UNVERIFIED: '请先在 Google 验证该邮箱',
				GOOGLE_NOT_CONFIGURED: 'Google 登录未配置',
			}
			console.error('Google OAuth callback failed:', codeName, err)
			return fail(map[codeName] || 'Google 登录失败，请稍后再试')
		}
	},
}
