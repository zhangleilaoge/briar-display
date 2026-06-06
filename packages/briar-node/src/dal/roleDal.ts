import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface RoleRecord {
	id: string
	name: string
	displayName: string
	description: string | null
	isSystem: boolean
	createdAt: Date
	updatedAt: Date
}

interface RoleRow {
	id: string
	name: string
	display_name: string
	description: string | null
	is_system: boolean | number
	created_at: Date
	updated_at: Date
}

const mapRowToRecord = (row: RoleRow): RoleRecord => ({
	id: row.id,
	name: row.name,
	displayName: row.display_name,
	description: row.description,
	isSystem: Boolean(row.is_system),
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

export const roleDal = {
	async list(): Promise<RoleRecord[]> {
		const rows = await query<RoleRow>(
			'SELECT id, name, display_name, description, is_system, created_at, updated_at FROM roles ORDER BY created_at ASC',
		)
		return rows.map(mapRowToRecord)
	},

	async findById(id: string): Promise<RoleRecord | null> {
		const row = await queryOne<RoleRow>(
			'SELECT id, name, display_name, description, is_system, created_at, updated_at FROM roles WHERE id = ?',
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findByName(name: string): Promise<RoleRecord | null> {
		const row = await queryOne<RoleRow>(
			'SELECT id, name, display_name, description, is_system, created_at, updated_at FROM roles WHERE name = ?',
			[name],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findByIds(ids: string[]): Promise<RoleRecord[]> {
		if (ids.length === 0) return []
		const placeholders = ids.map(() => '?').join(', ')
		const rows = await query<RoleRow>(
			`SELECT id, name, display_name, description, is_system, created_at, updated_at FROM roles WHERE id IN (${placeholders})`,
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
		await execute(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, values)
		return roleDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		// 系统角色不允许删除
		const role = await roleDal.findById(id)
		if (!role || role.isSystem) return false

		const result = await execute('DELETE FROM roles WHERE id = ?', [id])
		return result.affectedRows > 0
	},

	async getRolePermissions(roleId: string): Promise<string[]> {
		const rows = await query<{ permission_id: string }>(
			'SELECT permission_id FROM role_permissions WHERE role_id = ?',
			[roleId],
		)
		return rows.map((r) => r.permission_id)
	},

	async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
		const { transaction } = await import('../lib/db')
		await transaction(async (conn) => {
			await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId])
			if (permissionIds.length > 0) {
				const values = permissionIds.map((pid) => [roleId, pid])
				const placeholders = values.map(() => '(?, ?)').join(', ')
				const flatValues = values.flat()
				await conn.execute(
					`INSERT INTO role_permissions (role_id, permission_id) VALUES ${placeholders}`,
					flatValues,
				)
			}
		})
	},
}
