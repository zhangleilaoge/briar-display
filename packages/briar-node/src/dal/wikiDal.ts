import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface WikiRecord {
	id: string
	title: string
	slug: string
	content: string
	summary: string | null
	authorId: string
	viewCount: number
	status: 'draft' | 'published'
	createdAt: Date
	updatedAt: Date
}

interface WikiRow {
	id: string
	title: string
	slug: string
	content: string
	summary: string | null
	author_id: string
	view_count: number
	status: 'draft' | 'published'
	created_at: Date
	updated_at: Date
}

const mapRowToRecord = (row: WikiRow): WikiRecord => ({
	id: row.id,
	title: row.title,
	slug: row.slug,
	content: row.content,
	summary: row.summary,
	authorId: row.author_id,
	viewCount: row.view_count,
	status: row.status,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

export const wikiDal = {
	async list(limit = 20, offset = 0): Promise<WikiRecord[]> {
		// LIMIT 和 OFFSET 用字符串拼接（参数已验证为整数）
		const rows = await query<WikiRow>(
			`SELECT id, title, slug, content, summary, author_id, view_count, status, created_at, updated_at FROM wiki WHERE status = 'published' ORDER BY updated_at DESC LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
		)
		return rows.map(mapRowToRecord)
	},

	async listByAuthor(authorId: string): Promise<WikiRecord[]> {
		const rows = await query<WikiRow>(
			'SELECT id, title, slug, content, summary, author_id, view_count, status, created_at, updated_at FROM wiki WHERE author_id = ? ORDER BY updated_at DESC',
			[authorId],
		)
		return rows.map(mapRowToRecord)
	},

	async findBySlug(slug: string): Promise<WikiRecord | null> {
		const row = await queryOne<WikiRow>(
			'SELECT id, title, slug, content, summary, author_id, view_count, status, created_at, updated_at FROM wiki WHERE slug = ?',
			[slug],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findById(id: string): Promise<WikiRecord | null> {
		const row = await queryOne<WikiRow>(
			'SELECT id, title, slug, content, summary, author_id, view_count, status, created_at, updated_at FROM wiki WHERE id = ?',
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async create(
		data: Omit<WikiRecord, 'id' | 'viewCount' | 'createdAt' | 'updatedAt'>,
	): Promise<WikiRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO wiki (id, title, slug, content, summary, author_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[id, data.title, data.slug, data.content, data.summary, data.authorId, data.status],
		)

		const record = await wikiDal.findById(id)
		if (!record) {
			throw new Error('Failed to create wiki record')
		}
		return record
	},

	async update(
		id: string,
		data: Partial<Omit<WikiRecord, 'id' | 'createdAt' | 'updatedAt'>>,
	): Promise<WikiRecord | null> {
		const updates: string[] = []
		const values: any[] = []

		if (data.title !== undefined) {
			updates.push('title = ?')
			values.push(data.title)
		}
		if (data.slug !== undefined) {
			updates.push('slug = ?')
			values.push(data.slug)
		}
		if (data.content !== undefined) {
			updates.push('content = ?')
			values.push(data.content)
		}
		if (data.summary !== undefined) {
			updates.push('summary = ?')
			values.push(data.summary)
		}
		if (data.status !== undefined) {
			updates.push('status = ?')
			values.push(data.status)
		}

		if (updates.length === 0) {
			return wikiDal.findById(id)
		}

		values.push(id)
		await execute(`UPDATE wiki SET ${updates.join(', ')} WHERE id = ?`, values)

		return wikiDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM wiki WHERE id = ?', [id])
		return result.affectedRows > 0
	},

	async incrementViewCount(id: string): Promise<void> {
		await execute('UPDATE wiki SET view_count = view_count + 1 WHERE id = ?', [id])
	},
}
