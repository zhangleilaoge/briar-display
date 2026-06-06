import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface PermissionRecord {
	id: string
	code: string
	name: string
	description: string | null
	type: 'page' | 'api'
	module: string
	createdAt: Date
}

interface PermissionRow {
	id: string
	code: string
	name: string
	description: string | null
	type: 'page' | 'api'
	module: string
	created_at: Date
}

const mapRowToRecord = (row: PermissionRow): PermissionRecord => ({
	id: row.id,
	code: row.code,
	name: row.name,
	description: row.description,
	type: row.type,
	module: row.module,
	createdAt: row.created_at,
})

export const permissionDal = {
	async list(): Promise<PermissionRecord[]> {
		const rows = await query<PermissionRow>(
			'SELECT id, code, name, description, type, module, created_at FROM permissions ORDER BY type, module, code',
		)
		return rows.map(mapRowToRecord)
	},

	async findById(id: string): Promise<PermissionRecord | null> {
		const row = await queryOne<PermissionRow>(
			'SELECT id, code, name, description, type, module, created_at FROM permissions WHERE id = ?',
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findByCode(code: string): Promise<PermissionRecord | null> {
		const row = await queryOne<PermissionRow>(
			'SELECT id, code, name, description, type, module, created_at FROM permissions WHERE code = ?',
			[code],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findByIds(ids: string[]): Promise<PermissionRecord[]> {
		if (ids.length === 0) return []
		const placeholders = ids.map(() => '?').join(', ')
		const rows = await query<PermissionRow>(
			`SELECT id, code, name, description, type, module, created_at FROM permissions WHERE id IN (${placeholders})`,
			ids,
		)
		return rows.map(mapRowToRecord)
	},

	async create(data: {
		code: string
		name: string
		description?: string
		type: 'page' | 'api'
		module: string
	}): Promise<PermissionRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO permissions (id, code, name, description, type, module) VALUES (?, ?, ?, ?, ?, ?)',
			[id, data.code, data.name, data.description || null, data.type, data.module],
		)
		const record = await permissionDal.findById(id)
		if (!record) throw new Error('Failed to create permission')
		return record
	},

	async update(
		id: string,
		data: Partial<Pick<PermissionRecord, 'name' | 'description'>>,
	): Promise<PermissionRecord | null> {
		const updates: string[] = []
		const values: any[] = []

		if (data.name !== undefined) {
			updates.push('name = ?')
			values.push(data.name)
		}
		if (data.description !== undefined) {
			updates.push('description = ?')
			values.push(data.description)
		}

		if (updates.length === 0) return permissionDal.findById(id)

		values.push(id)
		await execute(`UPDATE permissions SET ${updates.join(', ')} WHERE id = ?`, values)
		return permissionDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM permissions WHERE id = ?', [id])
		return result.affectedRows > 0
	},

	/**
	 * 获取用户所有权限编码（通过角色关联）
	 */
	async getUserPermissionCodes(userId: string): Promise<string[]> {
		const rows = await query<{ code: string }>(
			`SELECT DISTINCT p.code
			 FROM permissions p
			 INNER JOIN role_permissions rp ON p.id = rp.permission_id
			 INNER JOIN user_roles ur ON rp.role_id = ur.role_id
			 WHERE ur.user_id = ?`,
			[userId],
		)
		return rows.map((r) => r.code)
	},

	/**
	 * 获取角色的所有权限详情
	 */
	async getRolePermissions(roleId: string): Promise<PermissionRecord[]> {
		const rows = await query<PermissionRow>(
			`SELECT p.id, p.code, p.name, p.description, p.type, p.module, p.created_at
			 FROM permissions p
			 INNER JOIN role_permissions rp ON p.id = rp.permission_id
			 WHERE rp.role_id = ?
			 ORDER BY p.type, p.module, p.code`,
			[roleId],
		)
		return rows.map(mapRowToRecord)
	},
}
