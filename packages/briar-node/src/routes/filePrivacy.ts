import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS, PRIVACY_LOCKED_CODE } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { privacyService } from '../services/privacyService'

type AuthedUser = { id: string }

function requireUser(c: Context): AuthedUser | null {
	return (c.get('user') as AuthedUser | undefined) ?? null
}

function unauthorized(c: Context) {
	return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
}

// ========== 供 files.ts 复用的隐私链路网关 ==========

/** 未解锁统一响应（code=PRIVACY_LOCKED_CODE，前端据此清 sessionStorage token 并弹解锁框） */
export function privacyLocked(c: Context) {
	return c.json<ApiResponse>(
		{ success: false, message: '请先解锁隐私空间', code: PRIVACY_LOCKED_CODE },
		HTTP_STATUS.FORBIDDEN,
	)
}

/** 当前请求是否持有有效解锁令牌（header x-privacy-token） */
export function hasPrivacyUnlock(c: Context, userId: string): boolean {
	const token = c.req.header('x-privacy-token')
	return !!token && privacyService.verifyUnlockToken(token, userId)
}

/**
 * 隐私链路写/读门禁：folderId 在隐私链路且未解锁时返回 403 响应，否则返回 null。
 * ownerId 用于访问他人文件的场景（文件夹树按文件属主查询）。
 */
export async function guardPrivateChain(
	c: Context,
	userId: string,
	folderId: string | null | undefined,
	ownerId = userId,
): Promise<Response | null> {
	if (!folderId) return null
	if (!(await privacyService.isPrivateChain(ownerId, folderId))) return null
	if (!hasPrivacyUnlock(c, userId)) return privacyLocked(c)
	return null
}

// ========== 隐私空间账号级路由（安全密码 / 验证码 / 解锁） ==========

const ERROR_MAP: Record<string, { message: string; status: number }> = {
	ALREADY_SET: { message: '已设置过安全密码，请使用修改或重置', status: HTTP_STATUS.BAD_REQUEST },
	NOT_SET: { message: '尚未设置安全密码', status: HTTP_STATUS.BAD_REQUEST },
	INVALID_PASSWORD: { message: '安全密码错误', status: HTTP_STATUS.BAD_REQUEST },
	INVALID_CODE: { message: '验证码错误或已过期', status: HTTP_STATUS.BAD_REQUEST },
	INVALID_CREDENTIALS: { message: '请提供安全密码或验证码', status: HTTP_STATUS.BAD_REQUEST },
	PASSWORD_TOO_SHORT: { message: '安全密码至少 6 位', status: HTTP_STATUS.BAD_REQUEST },
	SAME_AS_LOGIN: { message: '安全密码不能与登录密码相同', status: HTTP_STATUS.BAD_REQUEST },
	RATE_LIMITED: { message: '尝试过于频繁，请 1 分钟后再试', status: HTTP_STATUS.TOO_MANY_REQUESTS },
	SEND_EMAIL_FAILED: {
		message: '验证码发送失败，请稍后重试',
		status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
	},
	USER_NOT_FOUND: { message: '用户不存在', status: HTTP_STATUS.NOT_FOUND },
}

function privacyError(c: Context, err: unknown) {
	const key = err instanceof Error ? err.message : ''
	const mapped = ERROR_MAP[key]
	if (!mapped) {
		console.error('Privacy operation failed:', err)
		return c.json<ApiResponse>(
			{ success: false, message: '操作失败，请稍后重试' },
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		)
	}
	return c.json<ApiResponse>({ success: false, message: mapped.message }, mapped.status as any)
}

const filePrivacyRoutes = new Hono()

/** GET /status — 是否已设安全密码（决定前端走解锁还是首次设置流程） */
filePrivacyRoutes.get('/status', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)
	return c.json<ApiResponse>({ success: true, data: await privacyService.getStatus(user.id) })
})

/** POST /setup — 首次设置安全密码，成功即解锁（直接签发 token） */
filePrivacyRoutes.post('/setup', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)
	const body = await c.req.json<{ password?: string }>()
	if (!body.password) {
		return c.json<ApiResponse>(
			{ success: false, message: '安全密码不能为空' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	try {
		const data = await privacyService.setupPassword(user.id, body.password)
		return c.json<ApiResponse>({ success: true, data })
	} catch (err) {
		return privacyError(c, err)
	}
})

/** POST /change — 修改安全密码（校验旧密码） */
filePrivacyRoutes.post('/change', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)
	const body = await c.req.json<{ oldPassword?: string; newPassword?: string }>()
	if (!body.oldPassword || !body.newPassword) {
		return c.json<ApiResponse>({ success: false, message: '参数不完整' }, HTTP_STATUS.BAD_REQUEST)
	}
	try {
		await privacyService.changePassword(user.id, body.oldPassword, body.newPassword)
		return c.json<ApiResponse>({ success: true, message: '安全密码已修改' })
	} catch (err) {
		return privacyError(c, err)
	}
})

/** POST /send-code — 发送隐私空间验证码到账号邮箱 */
filePrivacyRoutes.post('/send-code', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)
	try {
		await privacyService.sendCode(user.id)
		return c.json<ApiResponse>({ success: true, message: '验证码已发送' })
	} catch (err) {
		return privacyError(c, err)
	}
})

/** POST /reset — 邮箱验证码重置安全密码（忘记密码通道） */
filePrivacyRoutes.post('/reset', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)
	const body = await c.req.json<{ code?: string; newPassword?: string }>()
	if (!body.code || !body.newPassword) {
		return c.json<ApiResponse>({ success: false, message: '参数不完整' }, HTTP_STATUS.BAD_REQUEST)
	}
	try {
		await privacyService.resetPassword(user.id, body.code, body.newPassword)
		return c.json<ApiResponse>({ success: true, message: '安全密码已重置' })
	} catch (err) {
		return privacyError(c, err)
	}
})

/** POST /unlock — 安全密码 / 邮箱验证码二选一解锁，签发 12h token */
filePrivacyRoutes.post('/unlock', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)
	const body = await c.req.json<{ password?: string; code?: string }>()
	try {
		const data = await privacyService.unlock(user.id, {
			password: body.password || undefined,
			code: body.code || undefined,
		})
		return c.json<ApiResponse>({ success: true, data })
	} catch (err) {
		return privacyError(c, err)
	}
})

export default filePrivacyRoutes
