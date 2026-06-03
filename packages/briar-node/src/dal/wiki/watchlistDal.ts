import { execute, query, queryOne } from '../../lib/db'

export interface WikiWatchlistRecord {
	userId: string
	pageId: string
	createdAt: Date
	pageTitle?: string
	pageSlug?: string
}

interface WikiWatchlistRow {
	user_id: string
	page_id: string
	created_at: Date
	page_title?: string
	page_slug?: string
}

const mapRowToRecord = (row: WikiWatchlistRow): WikiWatchlistRecord => ({
	userId: row.user_id,
	pageId: row.page_id,
	createdAt: row.created_at,
	pageTitle: row.page_title,
	pageSlug: row.page_slug,
})

export const watchlistDal = {
	async add(userId: string, pageId: string): Promise<void> {
		await execute('INSERT IGNORE INTO wiki_watchlist (user_id, page_id) VALUES (?, ?)', [
			userId,
			pageId,
		])
	},

	async remove(userId: string, pageId: string): Promise<boolean> {
		const result = await execute('DELETE FROM wiki_watchlist WHERE user_id = ? AND page_id = ?', [
			userId,
			pageId,
		])
		return result.affectedRows > 0
	},

	async isWatching(userId: string, pageId: string): Promise<boolean> {
		const row = await queryOne('SELECT 1 FROM wiki_watchlist WHERE user_id = ? AND page_id = ?', [
			userId,
			pageId,
		])
		return !!row
	},

	async listByUser(
		userId: string,
		limit = 20,
		offset = 0,
	): Promise<{ items: WikiWatchlistRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_watchlist WHERE user_id = ?',
			[userId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<WikiWatchlistRow>(
			`SELECT w.user_id, w.page_id, w.created_at,
				p.title as page_title, p.slug as page_slug
			FROM wiki_watchlist w
			INNER JOIN wiki_pages p ON w.page_id = p.id
			WHERE w.user_id = ?
			ORDER BY w.created_at DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[userId],
		)

		return { items: rows.map(mapRowToRecord), total }
	},

	async countByPage(pageId: string): Promise<number> {
		const row = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_watchlist WHERE page_id = ?',
			[pageId],
		)
		return row?.cnt || 0
	},
}
