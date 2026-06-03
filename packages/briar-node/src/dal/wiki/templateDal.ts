import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiTemplateRecord {
	id: string
	name: string
	slug: string
	content: string
	description: string | null
	authorId: string
	usageCount: number
	createdAt: Date
	updatedAt: Date
}

interface WikiTemplateRow {
	id: string
	name: string
	slug: string
	content: string
	description: string | null
	author_id: string
	usage_count: number
	created_at: Date
	updated_at: Date
}

const mapRowToRecord = (row: WikiTemplateRow): WikiTemplateRecord => ({
	id: row.id,
	name: row.name,
	slug: row.slug,
	content: row.content,
	description: row.description,
	authorId: row.author_id,
	usageCount: row.usage_count,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

const SELECT_FIELDS =
	'id, name, slug, content, description, author_id, usage_count, created_at, updated_at'

export const templateDal = {
	async create(
		data: Omit<WikiTemplateRecord, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>,
	): Promise<WikiTemplateRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO wiki_templates (id, name, slug, content, description, author_id) VALUES (?, ?, ?, ?, ?, ?)',
			[id, data.name, data.slug, data.content, data.description, data.authorId],
		)

		const record = await templateDal.findById(id)
		if (!record) {
			throw new Error('Failed to create template')
		}
		return record
	},

	async findBySlug(slug: string): Promise<WikiTemplateRecord | null> {
		const row = await queryOne<WikiTemplateRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_templates WHERE slug = ?`,
			[slug],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findById(id: string): Promise<WikiTemplateRecord | null> {
		const row = await queryOne<WikiTemplateRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_templates WHERE id = ?`,
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async list(limit = 20, offset = 0): Promise<{ items: WikiTemplateRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM wiki_templates')
		const total = countRow?.cnt || 0

		const rows = await query<WikiTemplateRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_templates ORDER BY usage_count DESC, name ASC LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
		)

		return { items: rows.map(mapRowToRecord), total }
	},

	async update(
		id: string,
		data: Partial<Omit<WikiTemplateRecord, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>>,
	): Promise<WikiTemplateRecord | null> {
		const updates: string[] = []
		const values: any[] = []

		if (data.name !== undefined) {
			updates.push('name = ?')
			values.push(data.name)
		}
		if (data.slug !== undefined) {
			updates.push('slug = ?')
			values.push(data.slug)
		}
		if (data.content !== undefined) {
			updates.push('content = ?')
			values.push(data.content)
		}
		if (data.description !== undefined) {
			updates.push('description = ?')
			values.push(data.description)
		}
		if (data.authorId !== undefined) {
			updates.push('author_id = ?')
			values.push(data.authorId)
		}

		if (updates.length === 0) {
			return templateDal.findById(id)
		}

		values.push(id)
		await execute(`UPDATE wiki_templates SET ${updates.join(', ')} WHERE id = ?`, values)

		return templateDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM wiki_templates WHERE id = ?', [id])
		return result.affectedRows > 0
	},

	async incrementUsageCount(id: string): Promise<void> {
		await execute('UPDATE wiki_templates SET usage_count = usage_count + 1 WHERE id = ?', [id])
	},
}
