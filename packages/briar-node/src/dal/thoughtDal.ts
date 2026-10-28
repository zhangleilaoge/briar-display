import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface ThoughtRecord {
	id: string
	userId: string
	body: string
	createdAt: Date
	updatedAt: Date
	authorName: string
	authorAvatar: string | null
	likeCount: number
	likedByMe: boolean
}

interface ThoughtRow {
	id: string
	user_id: string
	body: string
	created_at: Date
	updated_at: Date
	author_name: string
	author_avatar: string | null
	like_count: number | string
	liked_by_me: number | string | boolean
}

const SELECT_COLS = `SELECT t.id, t.user_id, t.body, t.created_at, t.updated_at,
	u.name AS author_name, u.avatar AS author_avatar,
	(SELECT COUNT(*) FROM thought_likes tl WHERE tl.thought_id = t.id) AS like_count`

const FROM_JOIN = `FROM thoughts t
	JOIN users u ON u.id = t.user_id AND u.deleted_at IS NULL`

const mapRow = (row: ThoughtRow): ThoughtRecord => ({
	id: row.id,
	userId: row.user_id,
	body: row.body,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	authorName: row.author_name,
	authorAvatar: row.author_avatar,
	likeCount: Number(row.like_count) || 0,
	likedByMe: Boolean(Number(row.liked_by_me)),
})

export const thoughtDal = {
	async create(data: { userId: string; body: string }): Promise<ThoughtRecord> {
		const id = generateId()
		await execute('INSERT INTO thoughts (id, user_id, body) VALUES (?, ?, ?)', [
			id,
			data.userId,
			data.body,
		])
		const record = await thoughtDal.findById(id, data.userId)
		if (!record) throw new Error('Failed to create thought')
		return record
	},

	async findById(id: string, viewerId?: string | null): Promise<ThoughtRecord | null> {
		const likedExpr = viewerId
			? `(SELECT COUNT(*) FROM thought_likes tl2 WHERE tl2.thought_id = t.id AND tl2.user_id = ?) AS liked_by_me`
			: `0 AS liked_by_me`
		const params: unknown[] = viewerId ? [viewerId, id] : [id]
		const row = await queryOne<ThoughtRow>(
			`${SELECT_COLS}, ${likedExpr}
			${FROM_JOIN}
			WHERE t.id = ? AND t.deleted_at IS NULL`,
			params,
		)
		return row ? mapRow(row) : null
	},

	async list(params: {
		page: number
		pageSize: number
		viewerId?: string | null
	}): Promise<{ items: ThoughtRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM thoughts WHERE deleted_at IS NULL',
		)
		const total = countRow?.cnt ?? 0
		const offset = (params.page - 1) * params.pageSize
		const likedExpr = params.viewerId
			? `(SELECT COUNT(*) FROM thought_likes tl2 WHERE tl2.thought_id = t.id AND tl2.user_id = ?) AS liked_by_me`
			: `0 AS liked_by_me`
		const sqlParams: unknown[] = params.viewerId
			? [params.viewerId, params.pageSize, offset]
			: [params.pageSize, offset]
		const rows = await query<ThoughtRow>(
			`${SELECT_COLS}, ${likedExpr}
			${FROM_JOIN}
			WHERE t.deleted_at IS NULL
			ORDER BY t.created_at DESC
			LIMIT ? OFFSET ?`,
			sqlParams,
		)
		return { items: rows.map(mapRow), total }
	},

	async updateBody(id: string, userId: string, body: string): Promise<ThoughtRecord | null> {
		const result = await execute(
			'UPDATE thoughts SET body = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
			[body, id, userId],
		)
		if (result.affectedRows === 0) return null
		return thoughtDal.findById(id, userId)
	},

	async softDelete(id: string, userId: string): Promise<boolean> {
		const result = await execute(
			'UPDATE thoughts SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
			[id, userId],
		)
		return result.affectedRows > 0
	},

	async like(thoughtId: string, userId: string): Promise<{ likeCount: number; liked: boolean }> {
		const id = generateId()
		await execute('INSERT IGNORE INTO thought_likes (id, thought_id, user_id) VALUES (?, ?, ?)', [
			id,
			thoughtId,
			userId,
		])
		return thoughtDal.likeStats(thoughtId, userId)
	},

	async unlike(thoughtId: string, userId: string): Promise<{ likeCount: number; liked: boolean }> {
		await execute('DELETE FROM thought_likes WHERE thought_id = ? AND user_id = ?', [
			thoughtId,
			userId,
		])
		return thoughtDal.likeStats(thoughtId, userId)
	},

	async likeStats(
		thoughtId: string,
		userId?: string | null,
	): Promise<{ likeCount: number; liked: boolean }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM thought_likes WHERE thought_id = ?',
			[thoughtId],
		)
		let liked = false
		if (userId) {
			const mine = await queryOne<{ cnt: number }>(
				'SELECT COUNT(*) AS cnt FROM thought_likes WHERE thought_id = ? AND user_id = ?',
				[thoughtId, userId],
			)
			liked = (mine?.cnt ?? 0) > 0
		}
		return { likeCount: countRow?.cnt ?? 0, liked }
	},
}
