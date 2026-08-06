import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface MessageRecord {
	id: string
	userId: string
	type: string
	title: string
	content: string
	readAt: Date | null
	createdAt: Date
}

interface MessageRow {
	id: string
	user_id: string
	type: string
	title: string
	content: string
	read_at: Date | null
	created_at: Date
}

const mapRow = (row: MessageRow): MessageRecord => ({
	id: row.id,
	userId: row.user_id,
	type: row.type,
	title: row.title,
	content: row.content,
	readAt: row.read_at,
	createdAt: row.created_at,
})

export const messageDal = {
	async create(data: {
		userId: string
		type?: string
		title: string
		content: string
	}): Promise<MessageRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO messages (id, user_id, type, title, content) VALUES (?, ?, ?, ?, ?)',
			[id, data.userId, data.type ?? 'system', data.title, data.content],
		)
		const record = await messageDal.findById(id)
		if (!record) throw new Error('Failed to create message')
		return record
	},

	async findById(id: string): Promise<MessageRecord | null> {
		const row = await queryOne<MessageRow>('SELECT * FROM messages WHERE id = ?', [id])
		return row ? mapRow(row) : null
	},

	async listByUser(
		userId: string,
		params: { page: number; pageSize: number },
	): Promise<{ items: MessageRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM messages WHERE user_id = ?',
			[userId],
		)
		const total = countRow?.cnt ?? 0

		const offset = (params.page - 1) * params.pageSize
		const rows = await query<MessageRow>(
			'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
			[userId, params.pageSize, offset],
		)

		return { items: rows.map(mapRow), total }
	},

	async countUnread(userId: string): Promise<number> {
		const row = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM messages WHERE user_id = ? AND read_at IS NULL',
			[userId],
		)
		return row?.cnt ?? 0
	},

	async markRead(id: string, userId: string): Promise<boolean> {
		const result = await execute(
			'UPDATE messages SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL',
			[id, userId],
		)
		return result.affectedRows > 0
	},

	async markAllRead(userId: string): Promise<number> {
		const result = await execute(
			'UPDATE messages SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
			[userId],
		)
		return result.affectedRows
	},
}
