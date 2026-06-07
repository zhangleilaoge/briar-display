import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS, PERMISSIONS } from '@briar/shared'
import { Hono } from 'hono'
import { requirePermission } from '../middleware/permissionMiddleware'
import { permissionService } from '../services/permissionService'

const adminRoutes = new Hono()

// ==================== 角色管理 ====================

/** 获取所有角色列表 */
adminRoutes.get('/roles', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), async (c) => {
	const roles = await permissionService.listRoles()
	return c.json<ApiResponse>({ success: true, data: roles })
})

/** 获取角色详情（含权限列表） */
adminRoutes.get('/roles/:id', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), async (c) => {
	const roleId = c.req.param('id')
	const role = await permissionService.getRoleWithPermissions(roleId)
	if (!role) {
		return c.json<ApiResponse>({ success: false, message: '角色不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	return c.json<ApiResponse>({ success: true, data: role })
})

/** 创建角色 */
adminRoutes.post('/roles', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), async (c) => {
	const body = await c.req.json<{ name: string; displayName: string; description?: string }>()
	if (!body.name || !body.displayName) {
		return c.json<ApiResponse>({ success: false, message: '名称不能为空' }, HTTP_STATUS.BAD_REQUEST)
	}

	try {
		const role = await permissionService.createRole(body)
		return c.json<ApiResponse>({ success: true, data: role }, HTTP_STATUS.CREATED)
	} catch (err: any) {
		if (err.message === 'ROLE_EXISTS') {
			return c.json<ApiResponse>(
				{ success: false, message: '角色标识已存在' },
				HTTP_STATUS.CONFLICT,
			)
		}
		throw err
	}
})

/** 更新角色 */
adminRoutes.put('/roles/:id', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), async (c) => {
	const roleId = c.req.param('id')
	const body = await c.req.json<{ displayName?: string; description?: string }>()

	const role = await permissionService.updateRole(roleId, body)
	if (!role) {
		return c.json<ApiResponse>({ success: false, message: '角色不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	return c.json<ApiResponse>({ success: true, data: role })
})

/** 删除角色 */
adminRoutes.delete('/roles/:id', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), async (c) => {
	const roleId = c.req.param('id')
	const deleted = await permissionService.deleteRole(roleId)
	if (!deleted) {
		return c.json<ApiResponse>(
			{ success: false, message: '角色不存在或为系统角色' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	return c.json<ApiResponse>({ success: true, message: '删除成功' })
})

/** 设置角色权限 */
adminRoutes.put(
	'/roles/:id/permissions',
	requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE),
	async (c) => {
		const roleId = c.req.param('id')
		const body = await c.req.json<{ permissionIds: string[] }>()

		if (!Array.isArray(body.permissionIds)) {
			return c.json<ApiResponse>(
				{ success: false, message: 'permissionIds 必须是数组' },
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		await permissionService.setRolePermissions(roleId, body.permissionIds)
		return c.json<ApiResponse>({ success: true, message: '权限设置成功' })
	},
)

// ==================== 权限管理 ====================

/** 获取所有权限列表 */
adminRoutes.get(
	'/permissions',
	requirePermission(PERMISSIONS.ADMIN_PERMISSION_MANAGE),
	async (c) => {
		const permissions = await permissionService.listPermissions()
		return c.json<ApiResponse>({ success: true, data: permissions })
	},
)

/** 创建权限 */
adminRoutes.post(
	'/permissions',
	requirePermission(PERMISSIONS.ADMIN_PERMISSION_MANAGE),
	async (c) => {
		const body = await c.req.json<{
			code: string
			name: string
			description?: string
			type: 'page' | 'api'
			module: string
		}>()

		if (!body.code || !body.name || !body.type || !body.module) {
			return c.json<ApiResponse>(
				{ success: false, message: '缺少必填字段' },
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		try {
			const perm = await permissionService.createPermission(body)
			return c.json<ApiResponse>({ success: true, data: perm }, HTTP_STATUS.CREATED)
		} catch (err: any) {
			if (err.message === 'PERMISSION_EXISTS') {
				return c.json<ApiResponse>(
					{ success: false, message: '权限编码已存在' },
					HTTP_STATUS.CONFLICT,
				)
			}
			throw err
		}
	},
)

/** 更新权限 */
adminRoutes.put(
	'/permissions/:id',
	requirePermission(PERMISSIONS.ADMIN_PERMISSION_MANAGE),
	async (c) => {
		const permId = c.req.param('id')
		const body = await c.req.json<{ name?: string; description?: string }>()

		const perm = await permissionService.updatePermission(permId, body)
		if (!perm) {
			return c.json<ApiResponse>({ success: false, message: '权限不存在' }, HTTP_STATUS.NOT_FOUND)
		}
		return c.json<ApiResponse>({ success: true, data: perm })
	},
)

/** 删除权限 */
adminRoutes.delete(
	'/permissions/:id',
	requirePermission(PERMISSIONS.ADMIN_PERMISSION_MANAGE),
	async (c) => {
		const permId = c.req.param('id')
		const deleted = await permissionService.deletePermission(permId)
		if (!deleted) {
			return c.json<ApiResponse>({ success: false, message: '权限不存在' }, HTTP_STATUS.NOT_FOUND)
		}
		return c.json<ApiResponse>({ success: true, message: '删除成功' })
	},
)

// ==================== 用户角色分配 ====================

/** 获取所有用户及其角色（支持搜索+分页） */
adminRoutes.get('/users', requirePermission(PERMISSIONS.ADMIN_USER_ROLE_ASSIGN), async (c) => {
	const keyword = c.req.query('keyword') || undefined
	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize')) || 20))
	const offset = (page - 1) * pageSize

	const { items, total } = await permissionService.searchUsersWithRoles({
		keyword,
		limit: pageSize,
		offset,
	})

	return c.json<ApiResponse>({
		success: true,
		data: { items, total, page, pageSize },
	})
})

/** 获取指定用户的角色 */
adminRoutes.get(
	'/users/:userId/roles',
	requirePermission(PERMISSIONS.ADMIN_USER_ROLE_ASSIGN),
	async (c) => {
		const userId = c.req.param('userId')
		const roles = await permissionService.getUserRoles(userId)
		return c.json<ApiResponse>({ success: true, data: roles })
	},
)

/** 设置用户角色 */
adminRoutes.put(
	'/users/:userId/roles',
	requirePermission(PERMISSIONS.ADMIN_USER_ROLE_ASSIGN),
	async (c) => {
		const userId = c.req.param('userId')
		const body = await c.req.json<{ roleIds: string[] }>()

		if (!Array.isArray(body.roleIds)) {
			return c.json<ApiResponse>(
				{ success: false, message: 'roleIds 必须是数组' },
				HTTP_STATUS.BAD_REQUEST,
			)
		}

		try {
			// 防止管理员自我降级
			const currentUser = (c as any).get('user') as { id: string } | undefined
			if (currentUser && currentUser.id === userId) {
				const isCurrentlyAdmin = await permissionService.isAdmin(userId)
				const willBeAdmin = body.roleIds.some(async (rid) => {
					const role = await permissionService.getRoleWithPermissions(rid)
					return role?.name === 'admin'
				})
				// 简化检查：如果当前是 admin 但新角色列表中没有 admin 角色 ID，拒绝
				if (isCurrentlyAdmin) {
					const roles = await permissionService.getUserRoles(userId)
					const adminRole = roles.find((r) => r.name === 'admin')
					if (adminRole && !body.roleIds.includes(adminRole.id)) {
						return c.json<ApiResponse>(
							{ success: false, message: '不能移除自己的管理员角色' },
							HTTP_STATUS.BAD_REQUEST,
						)
					}
				}
			}

			await permissionService.setUserRoles(userId, body.roleIds)
			return c.json<ApiResponse>({ success: true, message: '角色分配成功' })
		} catch (err: any) {
			if (err.message?.startsWith('Role not found')) {
				return c.json<ApiResponse>(
					{ success: false, message: err.message },
					HTTP_STATUS.BAD_REQUEST,
				)
			}
			throw err
		}
	},
)

/** 获取当前用户的权限信息 */
adminRoutes.get('/me/permissions', async (c) => {
	// authMiddleware 已在全局中间件中设置 user
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>(
			{ success: false, message: 'Unauthorized' },
			HTTP_STATUS.UNAUTHORIZED,
		)
	}

	const userWithRoles = await permissionService.getUserWithRoles(user.id)
	return c.json<ApiResponse>({ success: true, data: userWithRoles })
})

export default adminRoutes
