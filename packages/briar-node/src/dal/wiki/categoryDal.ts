import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiCategoryRecord {
	id: string
	name: string
	slug: string
	description: string | null
	parentId: string | null
	pageCount: number
	createdAt: Date
	updatedAt: Date
}

interface WikiCategoryRow {
	id: string
	name: string
	slug: string
	description: string | null
	parent_id: string | null
	page_count: number
	created_at: Date
	updated_at: Date
}

const mapRowToRecord = (row: WikiCategoryRow): WikiCategoryRecord => ({
	id: row.id,
	name: row.name,
	slug: row.slug,
	description: row.description,
	parentId: row.parent_id,
	pageCount: row.page_count,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

const SELECT_FIELDS = 'id, name, slug, description, parent_id, page_count, created_at, updated_at'

export const categoryDal = {
	async create(
		data: Omit<WikiCategoryRecord, 'id' | 'pageCount' | 'createdAt' | 'updatedAt'>,
	): Promise<WikiCategoryRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO wiki_categories (id, name, slug, description, parent_id) VALUES (?, ?, ?, ?, ?)',
			[id, data.name, data.slug, data.description, data.parentId],
		)

		const record = await categoryDal.findById(id)
		if (!record) {
			throw new Error('Failed to create category')
		}
		return record
	},

	async findBySlug(slug: string): Promise<WikiCategoryRecord | null> {
		const row = await queryOne<WikiCategoryRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_categories WHERE slug = ?`,
			[slug],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findById(id: string): Promise<WikiCategoryRecord | null> {
		const row = await queryOne<WikiCategoryRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_categories WHERE id = ?`,
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async list(limit = 50, offset = 0): Promise<{ items: WikiCategoryRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM wiki_categories')
		const total = countRow?.cnt || 0

		const rows = await query<WikiCategoryRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_categories ORDER BY name ASC LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
		)
		return { items: rows.map(mapRowToRecord), total }
	},

	async getTree(): Promise<WikiCategoryRecord[]> {
		const rows = await query<WikiCategoryRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_categories ORDER BY name ASC`,
		)
		return rows.map(mapRowToRecord)
	},

	async update(
		id: string,
		data: Partial<Omit<WikiCategoryRecord, 'id' | 'pageCount' | 'createdAt' | 'updatedAt'>>,
	): Promise<WikiCategoryRecord | null> {
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
		if (data.description !== undefined) {
			updates.push('description = ?')
			values.push(data.description)
		}
		if (data.parentId !== undefined) {
			updates.push('parent_id = ?')
			values.push(data.parentId)
		}

		if (updates.length === 0) {
			return categoryDal.findById(id)
		}

		values.push(id)
		await execute(`UPDATE wiki_categories SET ${updates.join(', ')} WHERE id = ?`, values)

		return categoryDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM wiki_categories WHERE id = ?', [id])
		return result.affectedRows > 0
	},

	async addPage(pageId: string, categoryId: string): Promise<void> {
		await execute('INSERT IGNORE INTO wiki_page_categories (page_id, category_id) VALUES (?, ?)', [
			pageId,
			categoryId,
		])
	},

	async removePage(pageId: string, categoryId: string): Promise<void> {
		await execute('DELETE FROM wiki_page_categories WHERE page_id = ? AND category_id = ?', [
			pageId,
			categoryId,
		])
	},

	async setPageCategories(pageId: string, categoryIds: string[]): Promise<void> {
		await execute('DELETE FROM wiki_page_categories WHERE page_id = ?', [pageId])

		if (categoryIds.length === 0) return

		const values = categoryIds.map((catId) => [pageId, catId])
		const placeholders = values.map(() => '(?, ?)').join(', ')
		const flatValues = values.flat()

		await execute(
			`INSERT INTO wiki_page_categories (page_id, category_id) VALUES ${placeholders}`,
			flatValues,
		)
	},

	async getPageCategories(pageId: string): Promise<WikiCategoryRecord[]> {
		const rows = await query<WikiCategoryRow>(
			`SELECT c.id, c.name, c.slug, c.description, c.parent_id, c.page_count, c.created_at, c.updated_at
			FROM wiki_categories c
			INNER JOIN wiki_page_categories pc ON c.id = pc.category_id
			WHERE pc.page_id = ?
			ORDER BY c.name ASC`,
			[pageId],
		)
		return rows.map(mapRowToRecord)
	},

	async getCategoryPages(
		categoryId: string,
		limit = 20,
		offset = 0,
	): Promise<{ items: any[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM wiki_page_categories pc
			INNER JOIN wiki_pages p ON pc.page_id = p.id
			WHERE pc.category_id = ? AND p.status != 'deleted'`,
			[categoryId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<any>(
			`SELECT p.id, p.title, p.slug, p.namespace, p.status, p.view_count, p.updated_at
			FROM wiki_pages p
			INNER JOIN wiki_page_categories pc ON p.id = pc.page_id
			WHERE pc.category_id = ? AND p.status != 'deleted'
			ORDER BY p.updated_at DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[categoryId],
		)

		return {
			items: rows.map((row: any) => ({
				id: row.id,
				title: row.title,
				slug: row.slug,
				namespace: row.namespace,
				status: row.status,
				viewCount: row.view_count,
				updatedAt: row.updated_at,
			})),
			total,
		}
	},

	async incrementPageCount(id: string): Promise<void> {
		await execute('UPDATE wiki_categories SET page_count = page_count + 1 WHERE id = ?', [id])
	},

	async decrementPageCount(id: string): Promise<void> {
		await execute(
			'UPDATE wiki_categories SET page_count = GREATEST(page_count - 1, 0) WHERE id = ?',
			[id],
		)
	},
}
