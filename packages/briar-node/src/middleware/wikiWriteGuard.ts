import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { MiddlewareHandler } from 'hono'
import { findRequiredPermission } from '../config/wikiPermissions'
import { permissionService } from '../services/permissionService'

/**
 * Wiki 写操作默认保护中间件
 *
 * 工作原理：
 * 1. 只拦截 POST/PUT/DELETE 请求（GET 不受影响）
 * 2. 在 WIKI_ROUTE_PERMISSIONS 映射表中查找该路由所需权限
 * 3. 如果找到 → 检查用户是否拥有该权限
 * 4. 如果未找到（新路由忘了声明）→ 默认拒绝，返回 403 + 开发提示
 * 5. 如果标记为 null → 显式公开，放行
 *
 * 这是安全网：即使开发者忘记在路由上加 requirePermission()，
 * 只要路由不在映射表中，写操作就会被拦截。
 */
export const wikiWriteGuard: MiddlewareHandler = async (c, next) => {
	const method = c.req.method

	// 只拦截写操作
	if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
		await next()
		return
	}

	// 获取相对于 /api/wiki 的路径
	const fullPath = c.req.path
	const relativePath = fullPath.replace('/api/wiki', '') || '/'

	const requiredPermission = findRequiredPermission(method, relativePath)

	// 显式标记为 null → 公开放行
	if (requiredPermission === null) {
		await next()
		return
	}

	// 未声明的写路由 → 默认拒绝
	if (requiredPermission === undefined) {
		console.warn(
			`⚠️ [wikiWriteGuard] 未声明权限的写路由: ${method} ${relativePath}\n   请在 wikiPermissions.ts 中添加映射，或显式标记为 null（公开）`,
		)
		return c.json<ApiResponse>(
			{
				success: false,
				message: '此接口未配置权限，请联系管理员',
				code: HTTP_STATUS.FORBIDDEN,
			},
			HTTP_STATUS.FORBIDDEN,
		)
	}

	// 已声明 → 检查权限
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>(
			{ success: false, message: 'Unauthorized', code: HTTP_STATUS.UNAUTHORIZED },
			HTTP_STATUS.UNAUTHORIZED,
		)
	}

	// 管理员放行
	const isAdmin = await permissionService.isAdmin(user.id)
	if (isAdmin) {
		await next()
		return
	}

	const hasPermission = await permissionService.hasPermission(user.id, requiredPermission)
	if (!hasPermission) {
		return c.json<ApiResponse>(
			{
				success: false,
				message: 'Forbidden: insufficient permissions',
				code: HTTP_STATUS.FORBIDDEN,
			},
			HTTP_STATUS.FORBIDDEN,
		)
	}

	await next()
}
