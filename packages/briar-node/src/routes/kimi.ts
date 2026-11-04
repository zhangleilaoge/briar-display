import type { ApiResponse, KimiUsageResponse } from '@briar/shared'
import { PERMISSIONS } from '@briar/shared'
import { Hono } from 'hono'
import { requirePermission } from '../middleware/permissionMiddleware'
import { getKimiUsage } from '../services/kimiUsageService'

/**
 * Kimi Code 用量代理（首页小组件）。
 * 用的是站长自己的 Kimi 账号（BRIAR_KIMI_API_KEY），仅管理员可看；Key 永不下发到浏览器。
 */
const kimiRoutes = new Hono()

/** GET /usage — 归一化后的 5 小时 / 周 / 月用量 + 重置时间；后端缓存 60s */
kimiRoutes.get('/usage', requirePermission(PERMISSIONS.PAGE_ADMIN), async (c) => {
	const data = await getKimiUsage()
	return c.json<ApiResponse<KimiUsageResponse>>({ success: true, data })
})

export default kimiRoutes
