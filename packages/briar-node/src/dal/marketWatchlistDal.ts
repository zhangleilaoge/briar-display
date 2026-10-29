import {
	type MarketId,
	type StockType,
	WATCHLIST_LIMIT,
	type WatchlistItem,
	generateId,
} from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

interface WatchlistRow {
	market: MarketId
	code: string
	name: string
	type: StockType
	created_at: Date
}

const mapRow = (row: WatchlistRow): WatchlistItem => ({
	market: row.market,
	code: row.code,
	name: row.name,
	type: row.type,
	addedAt: new Date(row.created_at).getTime(),
})

export const marketWatchlistDal = {
	/** 按加入时间升序（新加的在最后） */
	async list(userId: string): Promise<WatchlistItem[]> {
		const rows = await query<WatchlistRow>(
			'SELECT market, code, name, type, created_at FROM market_watchlist WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC',
			[userId],
		)
		return rows.map(mapRow)
	},

	async count(userId: string): Promise<number> {
		const row = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM market_watchlist WHERE user_id = ? AND deleted_at IS NULL',
			[userId],
		)
		return Number(row?.cnt ?? 0)
	},

	/** 批量加入（已存在的忽略），总数不超过 WATCHLIST_LIMIT；返回实际新增条数 */
	async add(userId: string, items: Omit<WatchlistItem, 'addedAt'>[]): Promise<number> {
		let room = WATCHLIST_LIMIT - (await marketWatchlistDal.count(userId))
		let added = 0
		for (const item of items) {
			if (room <= 0) break
			const result = await execute(
				// 已存在且未删除：不变（affectedRows=0）；已软删除：复活（deleted_at 必须最后赋值，前面的 IF 读的是旧值）
				`INSERT INTO market_watchlist (id, user_id, market, code, name, type) VALUES (?, ?, ?, ?, ?, ?)
				 ON DUPLICATE KEY UPDATE
				   name = IF(deleted_at IS NULL, name, VALUES(name)),
				   type = IF(deleted_at IS NULL, type, VALUES(type)),
				   created_at = IF(deleted_at IS NULL, created_at, NOW()),
				   deleted_at = NULL`,
				[generateId(), userId, item.market, item.code, item.name.slice(0, 100), item.type],
			)
			if (result.affectedRows > 0) {
				added++
				room--
			}
		}
		return added
	},

	async remove(userId: string, market: MarketId, code: string): Promise<void> {
		await execute(
			'UPDATE market_watchlist SET deleted_at = NOW() WHERE user_id = ? AND market = ? AND code = ? AND deleted_at IS NULL',
			[userId, market, code],
		)
	},
}
