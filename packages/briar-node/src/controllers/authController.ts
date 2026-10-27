import { type ApiResponse, HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { authService } from '../services/authService'

/** Google 相关错误码 → [HTTP 状态, 中文提示] */
const GOOGLE_ERRORS: Record<string, [number, string]> = {
	GOOGLE_ID_TOKEN_INVALID: [HTTP_STATUS.UNAUTHORIZED, 'Google 凭证无效，请重试'],
	GOOGLE_ID_TOKEN_EXPIRED: [HTTP_STATUS.UNAUTHORIZED, 'Google 凭证已过期，请重试'],
	GOOGLE_JWKS_UNAVAILABLE: [HTTP_STATUS.UNAUTHORIZED, '服务器暂无 Google 公钥，请稍后再试'],
	GOOGLE_PROFILE_INCOMPLETE: [HTTP_STATUS.UNAUTHORIZED, 'Google 账号缺少邮箱'],
	GOOGLE_EMAIL_UNVERIFIED: [HTTP_STATUS.UNAUTHORIZED, '请先在 Google 验证该邮箱'],
	GOOGLE_NOT_CONFIGURED: [HTTP_STATUS.UNAUTHORIZED, 'Google 登录未配置'],
	GOOGLE_EMAIL_CONFLICT: [
		HTTP_STATUS.CONFLICT,
		'该邮箱已注册本站账号，请先用密码登录后在用户菜单「绑定谷歌账号」',
	],
	GOOGLE_IDENTITY_TAKEN: [
		HTTP_STATUS.CONFLICT,
		'该 Google 账号已绑定其他用户，请联系管理员合并账号',
	],
	GOOGLE_ALREADY_BOUND: [HTTP_STATUS.CONFLICT, '已绑定其他 Google 账号，请先解绑'],
	GOOGLE_NOT_BOUND: [HTTP_STATUS.BAD_REQUEST, '尚未绑定 Google 账号'],
	LAST_LOGIN_METHOD: [
		HTTP_STATUS.BAD_REQUEST,
		'Google 是你唯一的登录方式，请先通过「忘记密码」设置登录密码再解绑',
	],
	USER_NOT_FOUND: [HTTP_STATUS.NOT_FOUND, '用户不存在'],
}

const googleErrorResponse = (c: Context, err: unknown, fallback: string) => {
	const codeName = err instanceof Error ? err.message : 'UNKNOWN'
	const known = GOOGLE_ERRORS[codeName]
	if (!known) console.error(`${fallback}:`, err)
	const [status, message] = known ?? [HTTP_STATUS.INTERNAL_SERVER_ERROR, `${fallback}，请稍后再试`]
	return c.json<ApiResponse>(
		{ success: false, message, code: status },
		status as 400 | 401 | 404 | 409 | 500,
	)
}

const currentUserId = (c: Context): string | null =>
	((c as any).get('user') as { id: string } | undefined)?.id ?? null

const readCredential = async (c: Context): Promise<string> => {
	const body = await c.req.json().catch(() => null)
	return typeof body?.credential === 'string' ? body.credential : ''
}

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
			return googleErrorResponse(c, err, 'Google 登录失败')
		}
	},

	/** GET /users/me/login-methods — 当前用户的登录方式（是否有密码 + 已绑定身份） */
	async loginMethods(c: Context) {
		const userId = currentUserId(c)
		if (!userId) {
			return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
		}
		try {
			const data = await authService.listLoginMethods(userId)
			return c.json<ApiResponse>({ success: true, data, code: HTTP_STATUS.OK })
		} catch (err) {
			return googleErrorResponse(c, err, '获取登录方式失败')
		}
	},

	/** POST /users/me/identities/google — body { credential }，把 Google 身份绑定到当前用户 */
	async bindGoogle(c: Context) {
		const userId = currentUserId(c)
		if (!userId) {
			return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
		}
		const credential = await readCredential(c)
		if (!credential) {
			return c.json<ApiResponse>(
				{ success: false, message: '缺少 Google 凭证', code: HTTP_STATUS.BAD_REQUEST },
				HTTP_STATUS.BAD_REQUEST,
			)
		}
		try {
			const profile = await authService.verifyGoogleCredential(credential)
			const data = await authService.bindGoogle(userId, profile)
			return c.json<ApiResponse>({ success: true, data, message: '已绑定 Google 账号' })
		} catch (err) {
			return googleErrorResponse(c, err, '绑定 Google 账号失败')
		}
	},

	/** DELETE /users/me/identities/google — 解绑（需还剩其它登录方式） */
	async unbindGoogle(c: Context) {
		const userId = currentUserId(c)
		if (!userId) {
			return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
		}
		try {
			const data = await authService.unbindGoogle(userId)
			return c.json<ApiResponse>({ success: true, data, message: '已解绑 Google 账号' })
		} catch (err) {
			return googleErrorResponse(c, err, '解绑 Google 账号失败')
		}
	},
}
