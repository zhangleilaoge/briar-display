import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiTagRecord {
	id: string
	name: string
	slug: string
	color: string
	pageCount: number
	createdAt: Date
}

interface WikiTagRow {
	id: string
	name: string
	slug: string
	color: string
	page_count: number
	created_at: Date
}

const mapRowToRecord = (row: WikiTagRow): WikiTagRecord => ({
	id: row.id,
	name: row.name,
	slug: row.slug,
	color: row.color,
	pageCount: row.page_count,
	createdAt: row.created_at,
})

const SELECT_FIELDS = 'id, name, slug, color, page_count, created_at'

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s\u4e00-\u9fff]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}

export const tagDal = {
	async create(data: { name: string; color?: string }): Promise<WikiTagRecord> {
		const id = generateId()
		const slug = generateSlug(data.name)
		const color = data.color || '#3b82f6'

		await execute('INSERT INTO wiki_tags (id, name, slug, color) VALUES (?, ?, ?, ?)', [
			id,
			data.name.trim(),
			slug,
			color,
		])

		const record = await tagDal.findById(id)
		if (!record) {
			throw new Error('Failed to create tag')
		}
		return record
	},

	async findById(id: string): Promise<WikiTagRecord | null> {
		const row = await queryOne<WikiTagRow>(`SELECT ${SELECT_FIELDS} FROM wiki_tags WHERE id = ?`, [
			id,
		])
		return row ? mapRowToRecord(row) : null
	},

	async findBySlug(slug: string): Promise<WikiTagRecord | null> {
		const row = await queryOne<WikiTagRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_tags WHERE slug = ?`,
			[slug],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findByName(name: string): Promise<WikiTagRecord | null> {
		const row = await queryOne<WikiTagRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_tags WHERE name = ?`,
			[name],
		)
		return row ? mapRowToRecord(row) : null
	},

	async list(): Promise<WikiTagRecord[]> {
		const rows = await query<WikiTagRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_tags ORDER BY page_count DESC, name ASC`,
		)
		return rows.map(mapRowToRecord)
	},

	async listByPageId(pageId: string): Promise<WikiTagRecord[]> {
		const rows = await query<WikiTagRow>(
			`SELECT t.${SELECT_FIELDS.replace(/id/g, 't.id')
				.replace(/name/g, 't.name')
				.replace(/slug/g, 't.slug')
				.replace(/color/g, 't.color')
				.replace(/page_count/g, 't.page_count')
				.replace(/created_at/g, 't.created_at')}
			FROM wiki_tags t
			INNER JOIN wiki_page_tags pt ON t.id = pt.tag_id
			WHERE pt.page_id = ?
			ORDER BY t.name ASC`,
			[pageId],
		)
		return rows.map(mapRowToRecord)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM wiki_tags WHERE id = ?', [id])
		return result.affectedRows > 0
	},

	// Page-tag associations
	async setPageTags(pageId: string, tagIds: string[]): Promise<void> {
		await execute('DELETE FROM wiki_page_tags WHERE page_id = ?', [pageId])

		if (tagIds.length === 0) return

		const placeholders = tagIds.map(() => '(?, ?)').join(', ')
		const flatValues = tagIds.flatMap((tagId) => [pageId, tagId])

		await execute(`INSERT INTO wiki_page_tags (page_id, tag_id) VALUES ${placeholders}`, flatValues)
	},

	async addPageTag(pageId: string, tagId: string): Promise<void> {
		await execute('INSERT IGNORE INTO wiki_page_tags (page_id, tag_id) VALUES (?, ?)', [
			pageId,
			tagId,
		])
	},

	async removePageTag(pageId: string, tagId: string): Promise<void> {
		await execute('DELETE FROM wiki_page_tags WHERE page_id = ? AND tag_id = ?', [pageId, tagId])
	},

	async incrementPageCount(id: string): Promise<void> {
		await execute('UPDATE wiki_tags SET page_count = page_count + 1 WHERE id = ?', [id])
	},

	async decrementPageCount(id: string): Promise<void> {
		await execute('UPDATE wiki_tags SET page_count = GREATEST(page_count - 1, 0) WHERE id = ?', [
			id,
		])
	},
}
