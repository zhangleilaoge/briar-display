import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiInlineCommentRecord {
	id: string
	pageId: string
	anchor: string
	content: string
	authorId: string
	resolved: boolean
	createdAt: Date
	updatedAt: Date
}

interface WikiInlineCommentRow {
	id: string
	page_id: string
	anchor: string
	content: string
	author_id: string
	resolved: number
	created_at: Date
	updated_at: Date
}

const mapRowToRecord = (row: WikiInlineCommentRow): WikiInlineCommentRecord => ({
	id: row.id,
	pageId: row.page_id,
	anchor: row.anchor,
	content: row.content,
	authorId: row.author_id,
	resolved: !!row.resolved,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

const SELECT_FIELDS = 'id, page_id, anchor, content, author_id, resolved, created_at, updated_at'

export const inlineCommentDal = {
	async create(data: {
		pageId: string
		anchor: string
		content: string
		authorId: string
	}): Promise<WikiInlineCommentRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO wiki_inline_comments (id, page_id, anchor, content, author_id) VALUES (?, ?, ?, ?, ?)',
			[id, data.pageId, data.anchor, data.content, data.authorId],
		)

		const record = await inlineCommentDal.findById(id)
		if (!record) {
			throw new Error('Failed to create inline comment')
		}
		return record
	},

	async findById(id: string): Promise<WikiInlineCommentRecord | null> {
		const row = await queryOne<WikiInlineCommentRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_inline_comments WHERE id = ?`,
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async listByPage(
		pageId: string,
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiInlineCommentRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_inline_comments WHERE page_id = ?',
			[pageId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<WikiInlineCommentRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_inline_comments WHERE page_id = ? ORDER BY created_at DESC LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[pageId],
		)
		return { items: rows.map(mapRowToRecord), total }
	},

	async listByAnchor(
		pageId: string,
		anchor: string,
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiInlineCommentRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_inline_comments WHERE page_id = ? AND anchor = ?',
			[pageId, anchor],
		)
		const total = countRow?.cnt || 0

		const rows = await query<WikiInlineCommentRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_inline_comments WHERE page_id = ? AND anchor = ? ORDER BY created_at ASC LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[pageId, anchor],
		)
		return { items: rows.map(mapRowToRecord), total }
	},

	async update(
		id: string,
		data: { content?: string; resolved?: boolean },
	): Promise<WikiInlineCommentRecord | null> {
		const updates: string[] = []
		const values: any[] = []

		if (data.content !== undefined) {
			updates.push('content = ?')
			values.push(data.content)
		}
		if (data.resolved !== undefined) {
			updates.push('resolved = ?')
			values.push(data.resolved)
		}

		if (updates.length === 0) {
			return inlineCommentDal.findById(id)
		}

		values.push(id)
		await execute(`UPDATE wiki_inline_comments SET ${updates.join(', ')} WHERE id = ?`, values)

		return inlineCommentDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM wiki_inline_comments WHERE id = ?', [id])
		return result.affectedRows > 0
	},
}
