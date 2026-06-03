import { generateId } from '@briar/shared'
import type { WikiNamespace, WikiPageStatus } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiPageRecord {
	id: string
	title: string
	slug: string
	content: string
	renderedHtml: string | null
	summary: string | null
	namespace: WikiNamespace
	status: WikiPageStatus
	authorId: string
	lastEditorId: string | null
	viewCount: number
	isRedirect: boolean
	redirectTarget: string | null
	createdAt: Date
	updatedAt: Date
}

interface WikiPageRow {
	id: string
	title: string
	slug: string
	content: string
	rendered_html: string | null
	summary: string | null
	namespace: WikiNamespace
	status: WikiPageStatus
	author_id: string
	last_editor_id: string | null
	view_count: number
	is_redirect: number
	redirect_target: string | null
	created_at: Date
	updated_at: Date
}

const mapRowToRecord = (row: WikiPageRow): WikiPageRecord => ({
	id: row.id,
	title: row.title,
	slug: row.slug,
	content: row.content,
	renderedHtml: row.rendered_html,
	summary: row.summary,
	namespace: row.namespace,
	status: row.status,
	authorId: row.author_id,
	lastEditorId: row.last_editor_id,
	viewCount: row.view_count,
	isRedirect: !!row.is_redirect,
	redirectTarget: row.redirect_target,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

const SELECT_FIELDS =
	'id, title, slug, content, rendered_html, summary, namespace, status, author_id, last_editor_id, view_count, is_redirect, redirect_target, created_at, updated_at'

const SELECT_SUMMARY_FIELDS =
	'id, title, slug, summary, namespace, status, author_id, last_editor_id, view_count, is_redirect, redirect_target, created_at, updated_at'

export const pageDal = {
	async list(params: {
		limit: number
		offset: number
		namespace?: WikiNamespace
		status?: WikiPageStatus
	}): Promise<{ items: WikiPageRecord[]; total: number }> {
		const conditions: string[] = []
		const values: any[] = []

		if (params.namespace) {
			conditions.push('namespace = ?')
			values.push(params.namespace)
		}
		if (params.status) {
			conditions.push('status = ?')
			values.push(params.status)
		}

		const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM wiki_pages ${where}`,
			values,
		)
		const total = countRow?.cnt || 0

		const items = await query<WikiPageRow>(
			`SELECT ${SELECT_SUMMARY_FIELDS} FROM wiki_pages ${where} ORDER BY updated_at DESC LIMIT ${Math.floor(params.limit)} OFFSET ${Math.floor(params.offset)}`,
			values,
		)

		return { items: items.map(mapRowToRecord), total }
	},

	async findBySlug(namespace: WikiNamespace, slug: string): Promise<WikiPageRecord | null> {
		const row = await queryOne<WikiPageRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_pages WHERE namespace = ? AND slug = ?`,
			[namespace, slug],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findById(id: string): Promise<WikiPageRecord | null> {
		const row = await queryOne<WikiPageRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_pages WHERE id = ?`,
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async search(
		queryStr: string,
		limit = 20,
		offset = 0,
	): Promise<{ items: WikiPageRecord[]; total: number }> {
		const matchExpr = 'MATCH(title, content) AGAINST(? IN BOOLEAN MODE)'

		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM wiki_pages WHERE status != 'deleted' AND ${matchExpr}`,
			[queryStr],
		)
		const total = countRow?.cnt || 0

		const items = await query<WikiPageRow>(
			`SELECT ${SELECT_SUMMARY_FIELDS}, ${matchExpr} as relevance
			FROM wiki_pages
			WHERE status != 'deleted' AND ${matchExpr}
			ORDER BY relevance DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[queryStr, queryStr],
		)

		return { items: items.map(mapRowToRecord), total }
	},

	async create(
		data: Omit<WikiPageRecord, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>,
	): Promise<WikiPageRecord> {
		const id = generateId()
		await execute(
			`INSERT INTO wiki_pages (id, title, slug, content, rendered_html, summary, namespace, status, author_id, last_editor_id, is_redirect, redirect_target)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				data.title,
				data.slug,
				data.content,
				data.renderedHtml,
				data.summary,
				data.namespace,
				data.status,
				data.authorId,
				data.lastEditorId,
				data.isRedirect,
				data.redirectTarget,
			],
		)

		const record = await pageDal.findById(id)
		if (!record) {
			throw new Error('Failed to create wiki page')
		}
		return record
	},

	async update(
		id: string,
		data: Partial<
			Omit<WikiPageRecord, 'id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'authorId'>
		>,
	): Promise<WikiPageRecord | null> {
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
		if (data.renderedHtml !== undefined) {
			updates.push('rendered_html = ?')
			values.push(data.renderedHtml)
		}
		if (data.summary !== undefined) {
			updates.push('summary = ?')
			values.push(data.summary)
		}
		if (data.namespace !== undefined) {
			updates.push('namespace = ?')
			values.push(data.namespace)
		}
		if (data.status !== undefined) {
			updates.push('status = ?')
			values.push(data.status)
		}
		if (data.lastEditorId !== undefined) {
			updates.push('last_editor_id = ?')
			values.push(data.lastEditorId)
		}
		if (data.isRedirect !== undefined) {
			updates.push('is_redirect = ?')
			values.push(data.isRedirect)
		}
		if (data.redirectTarget !== undefined) {
			updates.push('redirect_target = ?')
			values.push(data.redirectTarget)
		}

		if (updates.length === 0) {
			return pageDal.findById(id)
		}

		values.push(id)
		await execute(`UPDATE wiki_pages SET ${updates.join(', ')} WHERE id = ?`, values)

		return pageDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute("UPDATE wiki_pages SET status = 'deleted' WHERE id = ?", [id])
		return result.affectedRows > 0
	},

	async incrementViewCount(id: string): Promise<void> {
		await execute('UPDATE wiki_pages SET view_count = view_count + 1 WHERE id = ?', [id])
	},

	async checkSlugExists(
		namespace: WikiNamespace,
		slug: string,
		excludeId?: string,
	): Promise<boolean> {
		let sql = 'SELECT COUNT(*) as cnt FROM wiki_pages WHERE namespace = ? AND slug = ?'
		const values: any[] = [namespace, slug]

		if (excludeId) {
			sql += ' AND id != ?'
			values.push(excludeId)
		}

		const row = await queryOne<{ cnt: number }>(sql, values)
		return (row?.cnt || 0) > 0
	},

	async findRedirects(targetSlug: string): Promise<WikiPageRecord[]> {
		const rows = await query<WikiPageRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_pages WHERE is_redirect = TRUE AND redirect_target = ? AND status != 'deleted'`,
			[targetSlug],
		)
		return rows.map(mapRowToRecord)
	},
}
