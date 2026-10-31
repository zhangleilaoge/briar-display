import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface RoleRecord {
	id: string
	name: string
	displayName: string
	description: string | null
	level: number
	isSystem: boolean
	createdAt: Date
	updatedAt: Date
}

interface RoleRow {
	id: string
	name: string
	display_name: string
	description: string | null
	level: number
	is_system: boolean | number
	created_at: Date
	updated_at: Date
}

const mapRowToRecord = (row: RoleRow): RoleRecord => ({
	id: row.id,
	name: row.name,
	displayName: row.display_name,
	description: row.description,
	level: row.level,
	isSystem: Boolean(row.is_system),
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

export const roleDal = {
	async list(): Promise<RoleRecord[]> {
		const rows = await query<RoleRow>(
			'SELECT id, name, display_name, description, level, is_system, created_at, updated_at FROM roles WHERE deleted_at IS NULL ORDER BY created_at ASC',
		)
		return rows.map(mapRowToRecord)
	},

	async findById(id: string): Promise<RoleRecord | null> {
		const row = await queryOne<RoleRow>(
			'SELECT id, name, display_name, description, level, is_system, created_at, updated_at FROM roles WHERE id = ? AND deleted_at IS NULL',
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findByName(name: string): Promise<RoleRecord | null> {
		const row = await queryOne<RoleRow>(
			'SELECT id, name, display_name, description, level, is_system, created_at, updated_at FROM roles WHERE name = ? AND deleted_at IS NULL',
			[name],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findByIds(ids: string[]): Promise<RoleRecord[]> {
		if (ids.length === 0) return []
		const placeholders = ids.map(() => '?').join(', ')
		const rows = await query<RoleRow>(
			`SELECT id, name, display_name, description, level, is_system, created_at, updated_at FROM roles WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
			ids,
		)
		return rows.map(mapRowToRecord)
	},

	async create(data: {
		name: string
		displayName: string
		description?: string
	}): Promise<RoleRecord> {
		const id = generateId()
		await execute('INSERT INTO roles (id, name, display_name, description) VALUES (?, ?, ?, ?)', [
			id,
			data.name,
			data.displayName,
			data.description || null,
		])
		const record = await roleDal.findById(id)
		if (!record) throw new Error('Failed to create role')
		return record
	},

	async update(
		id: string,
		data: Partial<Pick<RoleRecord, 'displayName' | 'description'>>,
	): Promise<RoleRecord | null> {
		const updates: string[] = []
		const values: any[] = []

		if (data.displayName !== undefined) {
			updates.push('display_name = ?')
			values.push(data.displayName)
		}
		if (data.description !== undefined) {
			updates.push('description = ?')
			values.push(data.description)
		}

		if (updates.length === 0) return roleDal.findById(id)

		values.push(id)
		await execute(
			`UPDATE roles SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
			values,
		)
		return roleDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		// 系统角色不允许删除
		const role = await roleDal.findById(id)
		if (!role || role.isSystem) return false

		const result = await execute(
			'UPDATE roles SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
			[id],
		)
		return result.affectedRows > 0
	},

	async getRolePermissions(roleId: string): Promise<string[]> {
		const rows = await query<{ permission_id: string }>(
			'SELECT permission_id FROM role_permissions WHERE role_id = ? AND deleted_at IS NULL',
			[roleId],
		)
		return rows.map((r) => r.permission_id)
	},

	async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
		const { transaction } = await import('../lib/db')
		await transaction(async (conn) => {
			// 软删除：不在新列表里的关联标记删除，列表里的插入或复活
			if (permissionIds.length === 0) {
				await conn.execute(
					'UPDATE role_permissions SET deleted_at = NOW() WHERE role_id = ? AND deleted_at IS NULL',
					[roleId],
				)
			} else {
				await conn.execute(
					`UPDATE role_permissions SET deleted_at = NOW() WHERE role_id = ? AND deleted_at IS NULL AND permission_id NOT IN (${permissionIds.map(() => '?').join(', ')})`,
					[roleId, ...permissionIds],
				)
				const values = permissionIds.map((pid) => [roleId, pid])
				const placeholders = values.map(() => '(?, ?)').join(', ')
				const flatValues = values.flat()
				await conn.execute(
					`INSERT INTO role_permissions (role_id, permission_id) VALUES ${placeholders} ON DUPLICATE KEY UPDATE deleted_at = NULL`,
					flatValues,
				)
			}
		})
	},
}
