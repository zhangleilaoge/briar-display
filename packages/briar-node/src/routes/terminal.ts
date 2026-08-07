import { HTTP_STATUS, PERMISSIONS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { requirePermission } from '../middleware/permissionMiddleware'
import { authService } from '../services/authService'
import { terminalService } from '../services/terminalService'

const terminalRoutes = new Hono()

function requireUserId(c: Context): string {
	return (c.get('user') as { id: string }).id
}

/** POST /verification-code — 发送设备授权验证码到当前用户邮箱 */
terminalRoutes.post(
	'/verification-code',
	requirePermission(PERMISSIONS.ADMIN_TERMINAL_ACCESS),
	async (c) => {
		const id = requireUserId(c)
		const user = await authService.getUserById(id)
		if (!user?.email) {
			return c.json(
				{ success: false, message: '用户不存在或未绑定邮箱', code: HTTP_STATUS.BAD_REQUEST },
				HTTP_STATUS.BAD_REQUEST,
			)
		}
		try {
			await terminalService.sendAccessCode(user)
		} catch {
			return c.json(
				{
					success: false,
					message: '验证码发送失败，请稍后重试',
					code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
				},
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
		return c.json({ success: true, message: '验证码已发送', code: HTTP_STATUS.OK })
	},
)

/** POST /verify-device — 校验验证码，签发 7 天设备令牌 */
terminalRoutes.post(
	'/verify-device',
	requirePermission(PERMISSIONS.ADMIN_TERMINAL_ACCESS),
	async (c) => {
		const id = requireUserId(c)
		const user = await authService.getUserById(id)
		if (!user?.email) {
			return c.json(
				{ success: false, message: '用户不存在或未绑定邮箱', code: HTTP_STATUS.BAD_REQUEST },
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		let code = ''
		try {
			const body = await c.req.json<{ code?: string }>()
			code = (body.code || '').trim()
		} catch {
			// 忽略 JSON 解析错误，按空验证码处理
		}
		if (!code) {
			return c.json(
				{ success: false, message: '请输入验证码', code: HTTP_STATUS.BAD_REQUEST },
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		try {
			const { token, expiresAt } = await terminalService.verifyAccessCode(user, code)
			return c.json({
				success: true,
				data: { token, expiresAt },
				code: HTTP_STATUS.OK,
			})
		} catch {
			return c.json(
				{ success: false, message: '验证码错误或已过期', code: HTTP_STATUS.BAD_REQUEST },
				HTTP_STATUS.BAD_REQUEST,
			)
		}
	},
)

/** GET /host-info — 服务器信息（内存/CPU/硬盘/系统），需设备令牌 */
terminalRoutes.get(
	'/host-info',
	requirePermission(PERMISSIONS.ADMIN_TERMINAL_ACCESS),
	async (c) => {
		const id = requireUserId(c)
		const deviceToken = c.req.header('x-terminal-device') || ''
		if (!deviceToken || !terminalService.verifyDeviceToken(deviceToken, id)) {
			return c.json(
				{ success: false, message: '设备未授权，请先完成邮箱验证', code: HTTP_STATUS.FORBIDDEN },
				HTTP_STATUS.FORBIDDEN,
			)
		}

		try {
			const data = await terminalService.getHostInfo()
			return c.json({ success: true, data, code: HTTP_STATUS.OK })
		} catch (error) {
			console.error('[Terminal] 采集服务器信息失败:', error)
			return c.json(
				{ success: false, message: '服务器信息采集失败', code: HTTP_STATUS.INTERNAL_SERVER_ERROR },
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			)
		}
	},
)

export default terminalRoutes
