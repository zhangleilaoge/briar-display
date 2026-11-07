import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface TodoRecord {
	id: string
	userId: string
	title: string
	doneAt: Date | null
	sortOrder: number
	createdAt: Date
	updatedAt: Date
}

interface TodoRow {
	id: string
	user_id: string
	title: string
	done_at: Date | null
	sort_order: number
	created_at: Date
	updated_at: Date
}

const mapRow = (row: TodoRow): TodoRecord => ({
	id: row.id,
	userId: row.user_id,
	title: row.title,
	doneAt: row.done_at,
	sortOrder: row.sort_order,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

export const todoDal = {
	async listActive(): Promise<TodoRecord[]> {
		const rows = await query<TodoRow>(
			`SELECT id, user_id, title, done_at, sort_order, created_at, updated_at
			 FROM todos
			 WHERE deleted_at IS NULL
			 ORDER BY done_at IS NOT NULL ASC, sort_order ASC, created_at ASC`,
		)
		return rows.map(mapRow)
	},

	async findById(id: string): Promise<TodoRecord | null> {
		const row = await queryOne<TodoRow>(
			`SELECT id, user_id, title, done_at, sort_order, created_at, updated_at
			 FROM todos WHERE id = ? AND deleted_at IS NULL`,
			[id],
		)
		return row ? mapRow(row) : null
	},

	async create(data: { userId: string; title: string }): Promise<TodoRecord> {
		const id = generateId()
		const maxRow = await queryOne<{ m: number | null }>(
			'SELECT MAX(sort_order) AS m FROM todos WHERE deleted_at IS NULL',
		)
		const sortOrder = (maxRow?.m ?? 0) + 1
		await execute('INSERT INTO todos (id, user_id, title, sort_order) VALUES (?, ?, ?, ?)', [
			id,
			data.userId,
			data.title,
			sortOrder,
		])
		const record = await todoDal.findById(id)
		if (!record) throw new Error('Failed to create todo')
		return record
	},

	async updateTitle(id: string, title: string): Promise<TodoRecord | null> {
		const result = await execute('UPDATE todos SET title = ? WHERE id = ? AND deleted_at IS NULL', [
			title,
			id,
		])
		if (result.affectedRows === 0) return null
		return todoDal.findById(id)
	},

	async setDone(id: string, done: boolean): Promise<TodoRecord | null> {
		const result = await execute(
			done
				? 'UPDATE todos SET done_at = NOW() WHERE id = ? AND deleted_at IS NULL'
				: 'UPDATE todos SET done_at = NULL WHERE id = ? AND deleted_at IS NULL',
			[id],
		)
		if (result.affectedRows === 0) return null
		return todoDal.findById(id)
	},

	async softDelete(id: string): Promise<boolean> {
		const result = await execute(
			'UPDATE todos SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
			[id],
		)
		return result.affectedRows > 0
	},
}
