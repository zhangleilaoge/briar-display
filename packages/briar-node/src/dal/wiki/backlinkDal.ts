import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiBacklinkRecord {
	id: string
	sourcePageId: string
	targetPageId: string
	sourceSlug: string
	targetSlug: string
	createdAt: Date
}

interface WikiBacklinkRow {
	id: string
	source_page_id: string
	target_page_id: string
	source_slug: string
	target_slug: string
	created_at: Date
}

const mapRowToRecord = (row: WikiBacklinkRow): WikiBacklinkRecord => ({
	id: row.id,
	sourcePageId: row.source_page_id,
	targetPageId: row.target_page_id,
	sourceSlug: row.source_slug,
	targetSlug: row.target_slug,
	createdAt: row.created_at,
})

export const backlinkDal = {
	async create(data: {
		sourcePageId: string
		targetPageId: string
		sourceSlug: string
		targetSlug: string
	}): Promise<void> {
		const id = generateId()
		await execute(
			'INSERT IGNORE INTO wiki_backlinks (id, source_page_id, target_page_id, source_slug, target_slug) VALUES (?, ?, ?, ?, ?)',
			[id, data.sourcePageId, data.targetPageId, data.sourceSlug, data.targetSlug],
		)
	},

	async deleteBySourcePage(sourcePageId: string): Promise<void> {
		await execute('DELETE FROM wiki_backlinks WHERE source_page_id = ?', [sourcePageId])
	},

	async findByTargetPage(
		targetPageId: string,
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiBacklinkRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_backlinks WHERE target_page_id = ?',
			[targetPageId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<WikiBacklinkRow>(
			`SELECT id, source_page_id, target_page_id, source_slug, target_slug, created_at
			FROM wiki_backlinks
			WHERE target_page_id = ?
			ORDER BY created_at DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[targetPageId],
		)
		return { items: rows.map(mapRowToRecord), total }
	},

	async findBySourcePage(
		sourcePageId: string,
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiBacklinkRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_backlinks WHERE source_page_id = ?',
			[sourcePageId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<WikiBacklinkRow>(
			`SELECT id, source_page_id, target_page_id, source_slug, target_slug, created_at
			FROM wiki_backlinks
			WHERE source_page_id = ?
			ORDER BY created_at DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[sourcePageId],
		)
		return { items: rows.map(mapRowToRecord), total }
	},
}
