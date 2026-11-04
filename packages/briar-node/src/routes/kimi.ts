import type { ApiResponse, KimiUsageResponse } from '@briar/shared'
import { HTTP_STATUS, PERMISSIONS } from '@briar/shared'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { requirePermission } from '../middleware/permissionMiddleware'
import { clearKimiApiKey, getKimiUsage, saveKimiApiKey } from '../services/kimiUsageService'

/**
 * Kimi Code 用量代理（首页小组件）。
 * Key 存 site_secrets（密文），由管理员在卡片上填写；全文永不下发到浏览器。
 */
const kimiRoutes = new Hono()

type AuthedUser = { id: string }

function currentUser(c: Context): AuthedUser | undefined {
	return (c.get('user') as AuthedUser | undefined) ?? undefined
}

/** GET /usage — 归一化用量；未配置时 configured=false，前端展示填 Key 表单 */
kimiRoutes.get('/usage', requirePermission(PERMISSIONS.PAGE_ADMIN), async (c) => {
	const data = await getKimiUsage()
	return c.json<ApiResponse<KimiUsageResponse>>({ success: true, data })
})

/** PUT /api-key — 保存 / 覆盖 Key（body.apiKey）；响应只含脱敏 hint */
kimiRoutes.put('/api-key', requirePermission(PERMISSIONS.PAGE_ADMIN), async (c) => {
	const body = (await c.req.json().catch(() => null)) as { apiKey?: unknown } | null
	const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : ''
	try {
		const data = await saveKimiApiKey(apiKey, currentUser(c)?.id ?? null)
		return c.json<ApiResponse<{ hint: string }>>({ success: true, data, message: '已保存' })
	} catch (err) {
		const message = err instanceof Error ? err.message : '保存失败'
		return c.json<ApiResponse>(
			{ success: false, message, code: HTTP_STATUS.BAD_REQUEST },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
})

/** DELETE /api-key — 软删除已存 Key */
kimiRoutes.delete('/api-key', requirePermission(PERMISSIONS.PAGE_ADMIN), async (c) => {
	await clearKimiApiKey()
	return c.json<ApiResponse>({ success: true, message: '已清除' })
})

export default kimiRoutes
