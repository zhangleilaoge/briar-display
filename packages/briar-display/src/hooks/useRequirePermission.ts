'use client'

import { usePermissions } from '@/contexts/PermissionContext'

interface RequirePermissionResult {
	/** 权限接口仍在加载中 */
	loading: boolean
	/** 权限已加载且用户拥有权限 */
	authorized: boolean
	/** 权限已加载但用户没有权限 */
	denied: boolean
}

/**
 * 统一的权限检查 hook，返回三种状态。
 * 解决 loading 期间误判为「无权限」的问题。
 *
 * @example
 * const { loading, authorized, denied } = useRequirePermission('admin:role:manage')
 * if (loading) return <Spinner />
 * if (denied) return <NoPermission />
 * return <ActualContent />
 */
export function useRequirePermission(
	permission?: string,
	anyPermission?: string[],
): RequirePermissionResult {
	const { loading, isAdmin, hasPermission, hasAnyPermission, isLoggedIn } = usePermissions()

	if (loading) {
		return { loading: true, authorized: false, denied: false }
	}

	// 管理员放行
	if (isAdmin) {
		return { loading: false, authorized: true, denied: false }
	}

	// 未登录
	if (!isLoggedIn) {
		return { loading: false, authorized: false, denied: true }
	}

	// 单个权限检查
	if (permission && hasPermission(permission)) {
		return { loading: false, authorized: true, denied: false }
	}

	// 多权限检查（任一即可）
	if (anyPermission && hasAnyPermission(anyPermission)) {
		return { loading: false, authorized: true, denied: false }
	}

	return { loading: false, authorized: false, denied: true }
}
