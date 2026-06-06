'use client'

import { usePermissions } from '@/contexts/PermissionContext'
import type { ReactNode } from 'react'

interface PermissionGuardProps {
	/** 需要的权限编码 */
	permission?: string
	/** 需要的权限编码列表（任意一个即可） */
	anyPermission?: string[]
	/** 需要的权限编码列表（必须全部拥有） */
	allPermissions?: string[]
	/** 无权限时显示的替代内容 */
	fallback?: ReactNode
	/** 子组件 */
	children: ReactNode
}

/**
 * 权限守卫组件
 * 根据用户权限决定是否渲染子组件
 *
 * @example
 * <PermissionGuard permission="wiki:page:create">
 *   <Button>新建页面</Button>
 * </PermissionGuard>
 *
 * @example
 * <PermissionGuard anyPermission={["wiki:page:update", "wiki:page:delete"]} fallback={null}>
 *   <EditToolbar />
 * </PermissionGuard>
 */
export default function PermissionGuard({
	permission,
	anyPermission,
	allPermissions,
	fallback = null,
	children,
}: PermissionGuardProps) {
	const { hasPermission, hasAnyPermission, isAdmin, loading } = usePermissions()

	// 加载中不渲染任何内容
	if (loading) return null

	// 管理员拥有所有权限
	if (isAdmin) return <>{children}</>

	// 单个权限检查
	if (permission && hasPermission(permission)) return <>{children}</>

	// 任意一个权限检查
	if (anyPermission && hasAnyPermission(anyPermission)) return <>{children}</>

	// 所有权限检查
	if (allPermissions?.length && allPermissions.every((p) => hasPermission(p)))
		return <>{children}</>

	// 无权限
	return <>{fallback}</>
}
