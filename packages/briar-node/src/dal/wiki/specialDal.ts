import type { WikiNamespace } from '@briar/shared'
import { query, queryOne } from '../../lib/db'

export interface WikiRecentChangeRow {
	pageId: string
	pageTitle: string
	pageSlug: string
	namespace: WikiNamespace
	editorId: string
	editorName: string
	revisionNumber: number
	summary: string | null
	sizeBefore: number
	sizeAfter: number
	minorEdit: boolean
	createdAt: Date
}

export interface WikiStatistics {
	totalPages: number
	totalArticles: number
	totalRevisions: number
	totalCategories: number
	totalTemplates: number
	totalUsers: number
	recentEdits24h: number
}

export interface WikiPageListItem {
	id: string
	title: string
	slug: string
	namespace: WikiNamespace
	summary: string | null
	createdAt: Date
	updatedAt: Date
}

export interface WikiUserContributionRow {
	pageId: string
	pageTitle: string
	pageSlug: string
	revisionNumber: number
	summary: string | null
	sizeBefore: number
	sizeAfter: number
	createdAt: Date
}

const mapRecentChange = (row: any): WikiRecentChangeRow => ({
	pageId: row.page_id,
	pageTitle: row.page_title,
	pageSlug: row.page_slug,
	namespace: row.namespace,
	editorId: row.editor_id,
	editorName: row.editor_name,
	revisionNumber: row.revision_number,
	summary: row.summary,
	sizeBefore: row.size_before,
	sizeAfter: row.size_after,
	minorEdit: !!row.minor_edit,
	createdAt: row.created_at,
})

const mapPageListItem = (row: any): WikiPageListItem => ({
	id: row.id,
	title: row.title,
	slug: row.slug,
	namespace: row.namespace,
	summary: row.summary,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

const mapUserContribution = (row: any): WikiUserContributionRow => ({
	pageId: row.page_id,
	pageTitle: row.page_title,
	pageSlug: row.page_slug,
	revisionNumber: row.revision_number,
	summary: row.summary,
	sizeBefore: row.size_before,
	sizeAfter: row.size_after,
	createdAt: row.created_at,
})

export const specialDal = {
	async recentChanges(
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiRecentChangeRow[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM wiki_revisions')
		const total = countRow?.cnt || 0

		const rows = await query<any>(
			`SELECT r.page_id, p.title as page_title, p.slug as page_slug, p.namespace,
				r.editor_id, u.name as editor_name,
				r.revision_number, r.summary, r.size_before, r.size_after, r.minor_edit, r.created_at
			FROM wiki_revisions r
			INNER JOIN wiki_pages p ON r.page_id = p.id
			INNER JOIN users u ON r.editor_id = u.id
			WHERE p.status != 'deleted'
			ORDER BY r.created_at DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
		)

		return { items: rows.map(mapRecentChange), total }
	},

	async statistics(): Promise<WikiStatistics> {
		const [pagesRow, articlesRow, revisionsRow, categoriesRow, templatesRow, usersRow, recentRow] =
			await Promise.all([
				queryOne<{ cnt: number }>(
					"SELECT COUNT(*) as cnt FROM wiki_pages WHERE status != 'deleted'",
				),
				queryOne<{ cnt: number }>(
					"SELECT COUNT(*) as cnt FROM wiki_pages WHERE status = 'published' AND namespace = 'main'",
				),
				queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM wiki_revisions'),
				queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM wiki_categories'),
				queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM wiki_templates'),
				queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users'),
				queryOne<{ cnt: number }>(
					'SELECT COUNT(*) as cnt FROM wiki_revisions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
				),
			])

		return {
			totalPages: pagesRow?.cnt || 0,
			totalArticles: articlesRow?.cnt || 0,
			totalRevisions: revisionsRow?.cnt || 0,
			totalCategories: categoriesRow?.cnt || 0,
			totalTemplates: templatesRow?.cnt || 0,
			totalUsers: usersRow?.cnt || 0,
			recentEdits24h: recentRow?.cnt || 0,
		}
	},

	async allPages(
		namespace?: WikiNamespace,
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiPageListItem[]; total: number }> {
		const conditions = ["status != 'deleted'"]
		const values: any[] = []

		if (namespace) {
			conditions.push('namespace = ?')
			values.push(namespace)
		}

		const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM wiki_pages ${where}`,
			values,
		)
		const total = countRow?.cnt || 0

		const rows = await query<any>(
			`SELECT id, title, slug, namespace, summary, created_at, updated_at
			FROM wiki_pages ${where}
			ORDER BY title ASC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			values,
		)

		return { items: rows.map(mapPageListItem), total }
	},

	async orphanedPages(
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiPageListItem[]; total: number }> {
		// Pages not referenced by any other page's content via [[slug]]
		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM wiki_pages p
			WHERE p.status != 'deleted'
			AND NOT EXISTS (
				SELECT 1 FROM wiki_pages ref
				WHERE ref.status != 'deleted'
				AND ref.id != p.id
				AND ref.content LIKE CONCAT('%[[', p.slug, ']]%')
			)`,
		)
		const total = countRow?.cnt || 0

		const rows = await query<any>(
			`SELECT p.id, p.title, p.slug, p.namespace, p.summary, p.created_at, p.updated_at
			FROM wiki_pages p
			WHERE p.status != 'deleted'
			AND NOT EXISTS (
				SELECT 1 FROM wiki_pages ref
				WHERE ref.status != 'deleted'
				AND ref.id != p.id
				AND ref.content LIKE CONCAT('%[[', p.slug, ']]%')
			)
			ORDER BY p.title ASC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
		)

		return { items: rows.map(mapPageListItem), total }
	},

	async wantedPages(
		limit = 50,
		offset = 0,
	): Promise<{ items: { slug: string; referenceCount: number }[]; total: number }> {
		// Use application-layer regex extraction (same as backlinkService) instead of
		// fragile SQL SUBSTRING_INDEX tricks which mis-parse content like '122[[12Aa]]'.
		const rows = await query<any>(
			`SELECT content FROM wiki_pages WHERE status != 'deleted' AND content LIKE '%[[%'`,
		)

		const mentionRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
		const slugCounts = new Map<string, number>()

		for (const row of rows) {
			const content = row.content as string
			for (const match of content.matchAll(mentionRegex)) {
				const slug = match[1].trim().toLowerCase()
				slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1)
			}
		}

		if (slugCounts.size === 0) {
			return { items: [], total: 0 }
		}

		// Batch-query which slugs already exist
		const allSlugs = Array.from(slugCounts.keys())
		const placeholders = allSlugs.map(() => '?').join(',')
		const existingRows = await query<any>(
			`SELECT slug FROM wiki_pages WHERE slug IN (${placeholders}) AND status != 'deleted'`,
			allSlugs,
		)
		const existingSlugs = new Set(existingRows.map((r: any) => r.slug))

		const wanted = Array.from(slugCounts.entries())
			.filter(([slug]) => !existingSlugs.has(slug))
			.map(([slug, referenceCount]) => ({ slug, referenceCount }))
			.sort((a, b) => b.referenceCount - a.referenceCount)

		const total = wanted.length
		const items = wanted.slice(offset, offset + limit)

		return { items, total }
	},

	async userContributions(
		userId: string,
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiUserContributionRow[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_revisions WHERE editor_id = ?',
			[userId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<any>(
			`SELECT r.page_id, p.title as page_title, p.slug as page_slug,
				r.revision_number, r.summary, r.size_before, r.size_after, r.created_at
			FROM wiki_revisions r
			INNER JOIN wiki_pages p ON r.page_id = p.id
			WHERE r.editor_id = ?
			ORDER BY r.created_at DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[userId],
		)

		return { items: rows.map(mapUserContribution), total }
	},
}
