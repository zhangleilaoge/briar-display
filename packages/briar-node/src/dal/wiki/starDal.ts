import { execute, query } from '../../lib/db'

export interface WikiStarRecord {
	userId: string
	pageId: string
	createdAt: Date
}

interface WikiStarRow {
	user_id: string
	page_id: string
	created_at: Date
}

const mapRowToRecord = (row: WikiStarRow): WikiStarRecord => ({
	userId: row.user_id,
	pageId: row.page_id,
	createdAt: row.created_at,
})

export const starDal = {
	async add(userId: string, pageId: string): Promise<void> {
		await execute('INSERT IGNORE INTO wiki_stars (user_id, page_id) VALUES (?, ?)', [
			userId,
			pageId,
		])
	},

	async remove(userId: string, pageId: string): Promise<void> {
		await execute('DELETE FROM wiki_stars WHERE user_id = ? AND page_id = ?', [userId, pageId])
	},

	async isStarred(userId: string, pageId: string): Promise<boolean> {
		const row = await query<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_stars WHERE user_id = ? AND page_id = ?',
			[userId, pageId],
		)
		return (row[0]?.cnt || 0) > 0
	},

	async listByUser(userId: string, limit = 50, offset = 0): Promise<WikiStarRecord[]> {
		const rows = await query<WikiStarRow>(
			`SELECT user_id, page_id, created_at FROM wiki_stars
			WHERE user_id = ?
			ORDER BY created_at DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[userId],
		)
		return rows.map(mapRowToRecord)
	},

	async countByUser(userId: string): Promise<number> {
		const row = await query<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_stars WHERE user_id = ?',
			[userId],
		)
		return row[0]?.cnt || 0
	},
}
