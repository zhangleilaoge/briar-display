import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { MiddlewareHandler } from 'hono'
import { permissionService } from '../services/permissionService'

/**
 * 权限检查中间件
 * 要求用户已通过 authMiddleware 认证（c.get('user') 已设置）
 *
 * @param permissionCodes - 需要的权限编码列表
 * @param mode - 'any' = 拥有任意一个即可，'all' = 必须拥有所有
 */
export const requirePermission = (
	permissionCodes: string | string[],
	mode: 'any' | 'all' = 'any',
): MiddlewareHandler => {
	const codes = Array.isArray(permissionCodes) ? permissionCodes : [permissionCodes]

	return async (c, next) => {
		const user = c.get('user') as { id: string } | undefined
		if (!user) {
			return c.json<ApiResponse>(
				{ success: false, message: 'Unauthorized', code: HTTP_STATUS.UNAUTHORIZED },
				HTTP_STATUS.UNAUTHORIZED,
			)
		}

		// 管理员拥有所有权限
		const isAdmin = await permissionService.isAdmin(user.id)
		if (isAdmin) {
			await next()
			return
		}

		const hasPermission =
			mode === 'any'
				? await permissionService.hasAnyPermission(user.id, codes)
				: await permissionService.hasAllPermissions(user.id, codes)

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
}

/**
 * 页面访问权限中间件
 * 检查用户是否有访问指定页面的权限
 *
 * @param pagePermissionCode - 页面权限编码（如 'page:admin'）
 */
export const requirePageAccess = (pagePermissionCode: string): MiddlewareHandler => {
	return requirePermission(pagePermissionCode, 'any')
}
