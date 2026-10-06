import { type MarketId, WATCHLIST_LIMIT, type WatchlistItem, generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

interface WatchlistRow {
	market: MarketId
	code: string
	name: string
	created_at: Date
}

const mapRow = (row: WatchlistRow): WatchlistItem => ({
	market: row.market,
	code: row.code,
	name: row.name,
	addedAt: new Date(row.created_at).getTime(),
})

export const marketWatchlistDal = {
	/** 按加入时间升序（新加的在最后） */
	async list(userId: string): Promise<WatchlistItem[]> {
		const rows = await query<WatchlistRow>(
			'SELECT market, code, name, created_at FROM market_watchlist WHERE user_id = ? ORDER BY created_at ASC, id ASC',
			[userId],
		)
		return rows.map(mapRow)
	},

	async count(userId: string): Promise<number> {
		const row = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM market_watchlist WHERE user_id = ?',
			[userId],
		)
		return Number(row?.cnt ?? 0)
	},

	/** 批量加入（已存在的忽略），总数不超过 WATCHLIST_LIMIT；返回实际新增条数 */
	async add(
		userId: string,
		items: { market: MarketId; code: string; name: string }[],
	): Promise<number> {
		let room = WATCHLIST_LIMIT - (await marketWatchlistDal.count(userId))
		let added = 0
		for (const item of items) {
			if (room <= 0) break
			const result = await execute(
				'INSERT IGNORE INTO market_watchlist (id, user_id, market, code, name) VALUES (?, ?, ?, ?, ?)',
				[generateId(), userId, item.market, item.code, item.name.slice(0, 100)],
			)
			if (result.affectedRows > 0) {
				added++
				room--
			}
		}
		return added
	},

	async remove(userId: string, market: MarketId, code: string): Promise<void> {
		await execute('DELETE FROM market_watchlist WHERE user_id = ? AND market = ? AND code = ?', [
			userId,
			market,
			code,
		])
	},
}
