import type { Permission, Role, RoleWithPermissions, UserWithRoles } from '@briar/shared'
import { type PermissionRecord, permissionDal } from '../dal/permissionDal'
import { type RoleRecord, roleDal } from '../dal/roleDal'
import { userDal } from '../dal/userDal'
import { userRoleDal } from '../dal/userRoleDal'

// ==================== 缓存 ====================

/** 用户权限缓存：userId -> { permissions, roles, cachedAt } */
const userPermCache = new Map<
	string,
	{ permissions: string[]; roles: RoleRecord[]; cachedAt: number }
>()

const CACHE_TTL = 60_000 // 60秒缓存

const getCachedUserPerms = (userId: string) => {
	const cached = userPermCache.get(userId)
	if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
		return cached
	}
	return null
}

const invalidateUserPermCache = (userId?: string) => {
	if (userId) {
		userPermCache.delete(userId)
	} else {
		userPermCache.clear()
	}
}

// ==================== 映射函数 ====================

const toRole = (r: RoleRecord): Role => ({
	id: r.id,
	name: r.name,
	displayName: r.displayName,
	description: r.description ?? undefined,
	isSystem: r.isSystem,
	createdAt: r.createdAt,
})

const toPermission = (p: PermissionRecord): Permission => ({
	id: p.id,
	code: p.code,
	name: p.name,
	description: p.description ?? undefined,
	type: p.type,
	module: p.module,
})

// ==================== Service ====================

export const permissionService = {
	// ---------- 用户权限 ----------

	/**
	 * 获取用户的权限编码列表（带缓存）
	 */
	async getUserPermissions(userId: string): Promise<string[]> {
		const cached = getCachedUserPerms(userId)
		if (cached) return cached.permissions

		const permissions = await permissionDal.getUserPermissionCodes(userId)
		const roleIds = await userRoleDal.getUserRoleIds(userId)
		const roles: RoleRecord[] = []
		for (const rid of roleIds) {
			const role = await roleDal.findById(rid)
			if (role) roles.push(role)
		}

		userPermCache.set(userId, { permissions, roles, cachedAt: Date.now() })
		return permissions
	},

	/**
	 * 获取用户的完整信息（含角色和权限）
	 */
	async getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
		const user = await userDal.findById(userId)
		if (!user) return null

		const roleIds = await userRoleDal.getUserRoleIds(userId)
		const roles: Role[] = []
		for (const rid of roleIds) {
			const role = await roleDal.findById(rid)
			if (role) roles.push(toRole(role))
		}

		const permissions = await permissionDal.getUserPermissionCodes(userId)

		return {
			id: user.id,
			name: user.name,
			email: user.email,
			createdAt: user.createdAt,
			roles,
			permissions,
		}
	},

	/**
	 * 检查用户是否拥有指定权限
	 */
	async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
		const permissions = await this.getUserPermissions(userId)
		return permissions.includes(permissionCode)
	},

	/**
	 * 检查用户是否拥有任意一个权限
	 */
	async hasAnyPermission(userId: string, permissionCodes: string[]): Promise<boolean> {
		const permissions = await this.getUserPermissions(userId)
		return permissionCodes.some((code) => permissions.includes(code))
	},

	/**
	 * 检查用户是否拥有所有指定权限
	 */
	async hasAllPermissions(userId: string, permissionCodes: string[]): Promise<boolean> {
		const permissions = await this.getUserPermissions(userId)
		return permissionCodes.every((code) => permissions.includes(code))
	},

	/**
	 * 检查用户是否是管理员
	 */
	async isAdmin(userId: string): Promise<boolean> {
		const cached = getCachedUserPerms(userId)
		if (cached) {
			return cached.roles.some((r) => r.name === 'admin')
		}
		const roleIds = await userRoleDal.getUserRoleIds(userId)
		for (const rid of roleIds) {
			const role = await roleDal.findById(rid)
			if (role?.name === 'admin') return true
		}
		return false
	},

	/**
	 * 清除用户权限缓存
	 */
	invalidateCache(userId?: string) {
		invalidateUserPermCache(userId)
	},

	// ---------- 角色管理 ----------

	async listRoles(): Promise<Role[]> {
		const records = await roleDal.list()
		return records.map(toRole)
	},

	async getRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null> {
		const role = await roleDal.findById(roleId)
		if (!role) return null

		const permRecords = await permissionDal.getRolePermissions(roleId)
		return {
			...toRole(role),
			permissions: permRecords.map(toPermission),
		}
	},

	async createRole(data: {
		name: string
		displayName: string
		description?: string
	}): Promise<Role> {
		const existing = await roleDal.findByName(data.name)
		if (existing) throw new Error('ROLE_EXISTS')

		const record = await roleDal.create(data)
		return toRole(record)
	},

	async updateRole(
		roleId: string,
		data: { displayName?: string; description?: string },
	): Promise<Role | null> {
		const record = await roleDal.update(roleId, data)
		return record ? toRole(record) : null
	},

	async deleteRole(roleId: string): Promise<boolean> {
		const role = await roleDal.findById(roleId)
		if (!role || role.isSystem) return false

		// 清除拥有该角色的用户的缓存
		const userIds = await userRoleDal.getRoleUserIds(roleId)
		await roleDal.delete(roleId)
		for (const uid of userIds) {
			invalidateUserPermCache(uid)
		}
		return true
	},

	async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
		await roleDal.setRolePermissions(roleId, permissionIds)

		// 清除拥有该角色的用户的缓存
		const userIds = await userRoleDal.getRoleUserIds(roleId)
		for (const uid of userIds) {
			invalidateUserPermCache(uid)
		}
	},

	// ---------- 权限管理 ----------

	async listPermissions(): Promise<Permission[]> {
		const records = await permissionDal.list()
		return records.map(toPermission)
	},

	async createPermission(data: {
		code: string
		name: string
		description?: string
		type: 'page' | 'api'
		module: string
	}): Promise<Permission> {
		const existing = await permissionDal.findByCode(data.code)
		if (existing) throw new Error('PERMISSION_EXISTS')

		const record = await permissionDal.create(data)
		return toPermission(record)
	},

	async updatePermission(
		permId: string,
		data: { name?: string; description?: string },
	): Promise<Permission | null> {
		const record = await permissionDal.update(permId, data)
		if (record) {
			// 权限变更，清除所有缓存
			invalidateUserPermCache()
		}
		return record ? toPermission(record) : null
	},

	async deletePermission(permId: string): Promise<boolean> {
		const result = await permissionDal.delete(permId)
		if (result) invalidateUserPermCache()
		return result
	},

	// ---------- 用户角色分配 ----------

	async getUserRoles(userId: string): Promise<Role[]> {
		const roleIds = await userRoleDal.getUserRoleIds(userId)
		if (roleIds.length === 0) return []
		const records = await roleDal.findByIds(roleIds)
		return records.map(toRole)
	},

	async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
		// 校验所有 roleId 存在
		if (roleIds.length > 0) {
			const existing = await roleDal.findByIds(roleIds)
			if (existing.length !== roleIds.length) {
				throw new Error('Role not found')
			}
		}

		await userRoleDal.setUserRoles(userId, roleIds)
		invalidateUserPermCache(userId)
	},

	async getUsersWithRoles(): Promise<
		{ userId: string; userName: string; userEmail: string; roles: Role[] }[]
	> {
		const grouped = await userRoleDal.listGroupedByUser()
		// 收集所有 roleId，批量查询
		const allRoleIds = [
			...new Set([...grouped.values()].flatMap((info) => info.roles.map((r) => r.roleId))),
		]
		const roleMap = new Map((await roleDal.findByIds(allRoleIds)).map((r) => [r.id, r]))

		const result: { userId: string; userName: string; userEmail: string; roles: Role[] }[] = []
		for (const [userId, info] of grouped) {
			result.push({
				userId,
				userName: info.userName,
				userEmail: info.userEmail,
				roles: info.roles
					.map((r) => roleMap.get(r.roleId))
					.filter(Boolean)
					.map((r) => toRole(r!)),
			})
		}
		return result
	},

	/**
	 * 获取所有用户（含无角色的）
	 */
	async getAllUsersWithRoles(): Promise<
		{ userId: string; userName: string; userEmail: string; roles: Role[] }[]
	> {
		const allUsers = await userDal.list()
		const grouped = await userRoleDal.listGroupedByUser()
		// 批量获取所有角色
		const allRoleIds = [
			...new Set([...grouped.values()].flatMap((info) => info.roles.map((r) => r.roleId))),
		]
		const roleMap = new Map((await roleDal.findByIds(allRoleIds)).map((r) => [r.id, r]))

		return allUsers.map((user) => {
			const info = grouped.get(user.id)
			return {
				userId: user.id,
				userName: user.name,
				userEmail: user.email,
				roles: info
					? info.roles
							.map((r) => roleMap.get(r.roleId))
							.filter(Boolean)
							.map((r) => toRole(r!))
					: [],
			}
		})
	},

	/**
	 * 搜索用户（含角色），支持关键词 + 分页
	 */
	async searchUsersWithRoles(params: {
		keyword?: string
		limit: number
		offset: number
	}): Promise<{
		items: { userId: string; userName: string; userEmail: string; roles: Role[] }[]
		total: number
	}> {
		const { rows: users, total } = await userDal.search(params)

		// 只批量查当前页用户的角色
		const userIds = users.map((u) => u.id)
		if (userIds.length === 0) return { items: [], total }

		const allUserRoles = await userRoleDal.listGroupedByUser()
		const allRoleIds = [
			...new Set(
				userIds.flatMap((uid) => {
					const info = allUserRoles.get(uid)
					return info ? info.roles.map((r) => r.roleId) : []
				}),
			),
		]
		const roleMap = new Map((await roleDal.findByIds(allRoleIds)).map((r) => [r.id, r]))

		const items = users.map((user) => {
			const info = allUserRoles.get(user.id)
			return {
				userId: user.id,
				userName: user.name,
				userEmail: user.email,
				roles: info
					? info.roles
							.map((r) => roleMap.get(r.roleId))
							.filter(Boolean)
							.map((r) => toRole(r!))
					: [],
			}
		})

		return { items, total }
	},
}
