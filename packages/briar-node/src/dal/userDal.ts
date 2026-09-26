import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface UserRecord {
	id: string
	name: string
	email: string
	avatar: string | null
	passwordHash: string
	securityPasswordHash: string | null
	/** 令牌版本号：JWT tv 与其不一致即失效（改密码自增，吊销全部旧 token） */
	tokenVersion: number
	createdAt: Date
	updatedAt?: Date
}

interface UserRow {
	id: string
	name: string
	email: string
	avatar: string | null
	password_hash: string
	security_password_hash: string | null
	token_version: number
	created_at: Date
	updated_at: Date
}

const USER_COLUMNS =
	'id, name, email, avatar, password_hash, security_password_hash, token_version, created_at, updated_at'

const mapRowToRecord = (row: UserRow): UserRecord => ({
	id: row.id,
	name: row.name,
	email: row.email,
	avatar: row.avatar,
	passwordHash: row.password_hash,
	securityPasswordHash: row.security_password_hash,
	tokenVersion: row.token_version ?? 0,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

export const userDal = {
	async list(): Promise<UserRecord[]> {
		const rows = await query<UserRow>(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC`)
		return rows.map(mapRowToRecord)
	},

	async search(params: {
		keyword?: string
		limit: number
		offset: number
	}): Promise<{ rows: UserRecord[]; total: number }> {
		const conditions: string[] = []
		const values: any[] = []

		if (params.keyword) {
			conditions.push('(u.name LIKE ? OR u.email LIKE ?)')
			const like = `%${params.keyword}%`
			values.push(like, like)
		}

		const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) AS cnt FROM users u ${where}`,
			values,
		)
		const total = countRow?.cnt ?? 0

		const rows = await query<UserRow>(
			`SELECT u.id, u.name, u.email, u.avatar, u.password_hash, u.security_password_hash, u.token_version, u.created_at, u.updated_at
			 FROM users u ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
			[...values, params.limit, params.offset],
		)

		return { rows: rows.map(mapRowToRecord), total }
	},

	async findByEmail(email: string): Promise<UserRecord | null> {
		const row = await queryOne<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`, [
			email,
		])
		return row ? mapRowToRecord(row) : null
	},

	async findById(id: string): Promise<UserRecord | null> {
		const row = await queryOne<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id])
		return row ? mapRowToRecord(row) : null
	},

	async create(
		data: Omit<UserRecord, 'id' | 'createdAt' | 'securityPasswordHash' | 'tokenVersion'>,
	): Promise<UserRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO users (id, name, email, password_hash, avatar) VALUES (?, ?, ?, ?, ?)',
			[id, data.name, data.email, data.passwordHash, data.avatar ?? null],
		)

		const record = await userDal.findById(id)
		if (!record) {
			throw new Error('Failed to create user')
		}
		return record
	},

	async update(
		id: string,
		data: Partial<Omit<UserRecord, 'id' | 'createdAt'>>,
	): Promise<UserRecord | null> {
		const updates: string[] = []
		const values: any[] = []

		if (data.name !== undefined) {
			updates.push('name = ?')
			values.push(data.name)
		}
		if (data.email !== undefined) {
			updates.push('email = ?')
			values.push(data.email)
		}
		if (data.passwordHash !== undefined) {
			updates.push('password_hash = ?')
			values.push(data.passwordHash)
		}
		if (data.securityPasswordHash !== undefined) {
			updates.push('security_password_hash = ?')
			values.push(data.securityPasswordHash)
		}
		if (data.avatar !== undefined) {
			updates.push('avatar = ?')
			values.push(data.avatar)
		}

		if (updates.length === 0) {
			return userDal.findById(id)
		}

		values.push(id)
		await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values)

		return userDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM users WHERE id = ?', [id])
		return result.affectedRows > 0
	},

	/** token_version 自增：吊销该用户全部已签发 token（改密码后调用），返回最新记录 */
	async incrementTokenVersion(id: string): Promise<UserRecord | null> {
		await execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id])
		return userDal.findById(id)
	},
}
