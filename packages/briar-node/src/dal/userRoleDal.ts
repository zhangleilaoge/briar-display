import { execute, query, queryOne } from '../lib/db'

export interface UserRoleRecord {
	userId: string
	roleId: string
	createdAt: Date
}

export const userRoleDal = {
	/**
	 * 获取用户的角色 ID 列表
	 */
	async getUserRoleIds(userId: string): Promise<string[]> {
		const rows = await query<{ role_id: string }>(
			'SELECT role_id FROM user_roles WHERE user_id = ?',
			[userId],
		)
		return rows.map((r) => r.role_id)
	},

	/**
	 * 获取角色下的用户 ID 列表
	 */
	async getRoleUserIds(roleId: string): Promise<string[]> {
		const rows = await query<{ user_id: string }>(
			'SELECT user_id FROM user_roles WHERE role_id = ?',
			[roleId],
		)
		return rows.map((r) => r.user_id)
	},

	/**
	 * 检查用户是否拥有某个角色
	 */
	async hasRole(userId: string, roleId: string): Promise<boolean> {
		const row = await queryOne('SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?', [
			userId,
			roleId,
		])
		return !!row
	},

	/**
	 * 设置用户角色（替换模式）
	 */
	async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
		const { transaction } = await import('../lib/db')
		await transaction(async (conn) => {
			await conn.execute('DELETE FROM user_roles WHERE user_id = ?', [userId])
			if (roleIds.length > 0) {
				const values = roleIds.map((rid) => [userId, rid])
				const placeholders = values.map(() => '(?, ?)').join(', ')
				const flatValues = values.flat()
				await conn.execute(
					`INSERT INTO user_roles (user_id, role_id) VALUES ${placeholders}`,
					flatValues,
				)
			}
		})
	},

	/**
	 * 给用户添加单个角色
	 */
	async addRole(userId: string, roleId: string): Promise<void> {
		await execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [
			userId,
			roleId,
		])
	},

	/**
	 * 移除用户的单个角色
	 */
	async removeRole(userId: string, roleId: string): Promise<void> {
		await execute('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [userId, roleId])
	},

	/**
	 * 获取所有用户-角色关联（含用户和角色信息）
	 */
	async listAll(): Promise<
		{
			userId: string
			userName: string
			userEmail: string
			roleId: string
			roleName: string
			roleDisplayName: string
		}[]
	> {
		return query(
			`SELECT ur.user_id AS userId, u.name AS userName, u.email AS userEmail,
			        ur.role_id AS roleId, r.name AS roleName, r.display_name AS roleDisplayName
			 FROM user_roles ur
			 INNER JOIN users u ON ur.user_id = u.id
			 INNER JOIN roles r ON ur.role_id = r.id
			 ORDER BY u.name, r.name`,
		)
	},

	/**
	 * 按用户分组获取角色信息
	 */
	async listGroupedByUser(): Promise<
		Map<
			string,
			{
				userName: string
				userEmail: string
				roles: { roleId: string; roleName: string; roleDisplayName: string }[]
			}
		>
	> {
		const rows = await query<{
			userId: string
			userName: string
			userEmail: string
			roleId: string
			roleName: string
			roleDisplayName: string
		}>(
			`SELECT ur.user_id AS userId, u.name AS userName, u.email AS userEmail,
			        r.id AS roleId, r.name AS roleName, r.display_name AS roleDisplayName
			 FROM user_roles ur
			 INNER JOIN users u ON ur.user_id = u.id
			 INNER JOIN roles r ON ur.role_id = r.id
			 ORDER BY u.name, r.name`,
		)

		const grouped = new Map<
			string,
			{
				userName: string
				userEmail: string
				roles: { roleId: string; roleName: string; roleDisplayName: string }[]
			}
		>()
		for (const row of rows) {
			const existing = grouped.get(row.userId)
			if (existing) {
				existing.roles.push({
					roleId: row.roleId,
					roleName: row.roleName,
					roleDisplayName: row.roleDisplayName,
				})
			} else {
				grouped.set(row.userId, {
					userName: row.userName,
					userEmail: row.userEmail,
					roles: [
						{ roleId: row.roleId, roleName: row.roleName, roleDisplayName: row.roleDisplayName },
					],
				})
			}
		}
		return grouped
	},
}
