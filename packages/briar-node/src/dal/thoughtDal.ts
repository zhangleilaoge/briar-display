import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface ThoughtRecord {
	id: string
	userId: string
	body: string
	createdAt: Date
	updatedAt: Date
	authorName: string
	authorAvatar: string | null
}

interface ThoughtRow {
	id: string
	user_id: string
	body: string
	created_at: Date
	updated_at: Date
	author_name: string
	author_avatar: string | null
}

const SELECT_WITH_AUTHOR = `SELECT t.id, t.user_id, t.body, t.created_at, t.updated_at,
	u.name AS author_name, u.avatar AS author_avatar
	FROM thoughts t
	JOIN users u ON u.id = t.user_id AND u.deleted_at IS NULL`

const mapRow = (row: ThoughtRow): ThoughtRecord => ({
	id: row.id,
	userId: row.user_id,
	body: row.body,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	authorName: row.author_name,
	authorAvatar: row.author_avatar,
})

export const thoughtDal = {
	async create(data: { userId: string; body: string }): Promise<ThoughtRecord> {
		const id = generateId()
		await execute('INSERT INTO thoughts (id, user_id, body) VALUES (?, ?, ?)', [
			id,
			data.userId,
			data.body,
		])
		const record = await thoughtDal.findById(id)
		if (!record) throw new Error('Failed to create thought')
		return record
	},

	async findById(id: string): Promise<ThoughtRecord | null> {
		const row = await queryOne<ThoughtRow>(
			`${SELECT_WITH_AUTHOR} WHERE t.id = ? AND t.deleted_at IS NULL`,
			[id],
		)
		return row ? mapRow(row) : null
	},

	async list(params: {
		page: number
		pageSize: number
	}): Promise<{ items: ThoughtRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM thoughts WHERE deleted_at IS NULL',
		)
		const total = countRow?.cnt ?? 0
		const offset = (params.page - 1) * params.pageSize
		const rows = await query<ThoughtRow>(
			`${SELECT_WITH_AUTHOR} WHERE t.deleted_at IS NULL ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
			[params.pageSize, offset],
		)
		return { items: rows.map(mapRow), total }
	},

	async softDelete(id: string, userId: string): Promise<boolean> {
		const result = await execute(
			'UPDATE thoughts SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
			[id, userId],
		)
		return result.affectedRows > 0
	},
}
