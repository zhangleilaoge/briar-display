import { extractThoughtTags, generateId, parseThoughtTagList } from '@briar/shared'
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
	tags: string[]
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
	tags: [],
})

export const thoughtDal = {
	async create(data: { userId: string; body: string }): Promise<ThoughtRecord> {
		const id = generateId()
		await execute('INSERT INTO thoughts (id, user_id, body) VALUES (?, ?, ?)', [
			id,
			data.userId,
			data.body,
		])
		await thoughtDal.syncTags(id, data.body)
		const record = await thoughtDal.findById(id, data.userId)
		if (!record) throw new Error('Failed to create thought')
		return record
	},

	async findById(id: string, viewerId?: string | null): Promise<ThoughtRecord | null> {
		const likedExpr = viewerId
			? '(SELECT COUNT(*) FROM thought_likes tl2 WHERE tl2.thought_id = t.id AND tl2.user_id = ?) AS liked_by_me'
			: '0 AS liked_by_me'
		const params: unknown[] = viewerId ? [viewerId, id] : [id]
		const row = await queryOne<ThoughtRow>(
			`${SELECT_COLS}, ${likedExpr}
			${FROM_JOIN}
			WHERE t.id = ? AND t.deleted_at IS NULL`,
			params,
		)
		if (!row) return null
		const [record] = await thoughtDal.attachTags([mapRow(row)])
		return record ?? null
	},

	async list(params: {
		page: number
		pageSize: number
		viewerId?: string | null
		/** 任一命中（OR） */
		tags?: string[]
	}): Promise<{ items: ThoughtRecord[]; total: number }> {
		const tags = parseThoughtTagList(params.tags ?? [])
		const tagWhere = tags.length
			? ` AND EXISTS (SELECT 1 FROM thought_tags tt WHERE tt.thought_id = t.id AND tt.tag IN (${tags.map(() => '?').join(', ')}) AND tt.deleted_at IS NULL)`
			: ''
		const tagParams: unknown[] = tags
		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) AS cnt ${FROM_JOIN} WHERE t.deleted_at IS NULL${tagWhere}`,
			tagParams,
		)
		const total = countRow?.cnt ?? 0
		const offset = (params.page - 1) * params.pageSize
		const likedExpr = params.viewerId
			? '(SELECT COUNT(*) FROM thought_likes tl2 WHERE tl2.thought_id = t.id AND tl2.user_id = ?) AS liked_by_me'
			: '0 AS liked_by_me'
		const sqlParams: unknown[] = params.viewerId
			? [params.viewerId, ...tagParams, params.pageSize, offset]
			: [...tagParams, params.pageSize, offset]
		const rows = await query<ThoughtRow>(
			`${SELECT_COLS}, ${likedExpr}
			${FROM_JOIN}
			WHERE t.deleted_at IS NULL${tagWhere}
			ORDER BY t.created_at DESC
			LIMIT ? OFFSET ?`,
			sqlParams,
		)
		return { items: await thoughtDal.attachTags(rows.map(mapRow)), total }
	},

	async updateBody(id: string, userId: string, body: string): Promise<ThoughtRecord | null> {
		const result = await execute(
			'UPDATE thoughts SET body = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
			[body, id, userId],
		)
		if (result.affectedRows === 0) return null
		await thoughtDal.syncTags(id, body)
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

	/** 按正文同步标签：新增的插入/恢复，移除的软删 */
	async syncTags(thoughtId: string, body: string): Promise<string[]> {
		const tags = extractThoughtTags(body)
		if (tags.length > 0) {
			await execute(
				`UPDATE thought_tags SET deleted_at = NOW()
				WHERE thought_id = ? AND deleted_at IS NULL AND tag NOT IN (${tags.map(() => '?').join(', ')})`,
				[thoughtId, ...tags],
			)
			for (const tag of tags) {
				await execute(
					'INSERT INTO thought_tags (id, thought_id, tag) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE deleted_at = NULL',
					[generateId(), thoughtId, tag],
				)
			}
		} else {
			await execute(
				'UPDATE thought_tags SET deleted_at = NOW() WHERE thought_id = ? AND deleted_at IS NULL',
				[thoughtId],
			)
		}
		return tags
	},

	async attachTags(records: ThoughtRecord[]): Promise<ThoughtRecord[]> {
		if (records.length === 0) return records
		const rows = await query<{ thought_id: string; tag: string }>(
			`SELECT thought_id, tag FROM thought_tags
			WHERE deleted_at IS NULL AND thought_id IN (${records.map(() => '?').join(', ')})
			ORDER BY created_at, tag`,
			records.map((r) => r.id),
		)
		const byId = new Map<string, string[]>()
		for (const r of rows) {
			const list = byId.get(r.thought_id) ?? []
			list.push(r.tag)
			byId.set(r.thought_id, list)
		}
		return records.map((r) => ({ ...r, tags: byId.get(r.id) ?? [] }))
	},

	/** 标签列表 + 未删除想法数（热门在前） */
	async listTags(limit = 100): Promise<{ tag: string; count: number }[]> {
		const rows = await query<{ tag: string; cnt: number | string }>(
			`SELECT tt.tag, COUNT(*) AS cnt
			FROM thought_tags tt
			JOIN thoughts t ON t.id = tt.thought_id AND t.deleted_at IS NULL
			JOIN users u ON u.id = t.user_id AND u.deleted_at IS NULL
			WHERE tt.deleted_at IS NULL
			GROUP BY tt.tag
			ORDER BY cnt DESC, tt.tag ASC
			LIMIT ?`,
			[limit],
		)
		return rows.map((r) => ({ tag: r.tag, count: Number(r.cnt) || 0 }))
	},

	/** 存量回填：从未同步过标签（无任何 thought_tags 行）且正文含 # 的想法 */
	async backfillTags(): Promise<number> {
		const rows = await query<{ id: string; body: string }>(
			`SELECT t.id, t.body FROM thoughts t
			WHERE t.deleted_at IS NULL AND t.body LIKE '%#%'
			AND NOT EXISTS (SELECT 1 FROM thought_tags tt WHERE tt.thought_id = t.id)`,
		)
		let n = 0
		for (const r of rows) {
			if ((await thoughtDal.syncTags(r.id, r.body)).length > 0) n++
		}
		return n
	},
}
