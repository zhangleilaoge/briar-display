import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export type GuestbookStatus = 'pending' | 'approved' | 'rejected'

export interface GuestbookRecord {
	id: string
	nickname: string
	content: string
	status: GuestbookStatus
	ip: string | null
	userAgent: string | null
	reviewedAt: Date | null
	reviewedBy: string | null
	createdAt: Date
	updatedAt: Date
}

interface GuestbookRow {
	id: string
	nickname: string
	content: string
	status: GuestbookStatus
	ip: string | null
	user_agent: string | null
	reviewed_at: Date | null
	reviewed_by: string | null
	created_at: Date
	updated_at: Date
}

const mapRow = (row: GuestbookRow): GuestbookRecord => ({
	id: row.id,
	nickname: row.nickname,
	content: row.content,
	status: row.status,
	ip: row.ip,
	userAgent: row.user_agent,
	reviewedAt: row.reviewed_at,
	reviewedBy: row.reviewed_by,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

const SELECT_COLS =
	'id, nickname, content, status, ip, user_agent, reviewed_at, reviewed_by, created_at, updated_at'

export const guestbookDal = {
	async create(data: {
		nickname: string
		content: string
		ip?: string | null
		userAgent?: string | null
	}): Promise<GuestbookRecord> {
		const id = generateId()
		await execute(
			`INSERT INTO guestbook_entries (id, nickname, content, status, ip, user_agent)
			 VALUES (?, ?, ?, 'pending', ?, ?)`,
			[id, data.nickname, data.content, data.ip ?? null, data.userAgent ?? null],
		)
		const record = await guestbookDal.findById(id)
		if (!record) throw new Error('Failed to create guestbook entry')
		return record
	},

	async findById(id: string): Promise<GuestbookRecord | null> {
		const row = await queryOne<GuestbookRow>(
			`SELECT ${SELECT_COLS} FROM guestbook_entries WHERE id = ? AND deleted_at IS NULL`,
			[id],
		)
		return row ? mapRow(row) : null
	},

	async list(params: {
		status: GuestbookStatus | GuestbookStatus[]
		page: number
		pageSize: number
	}): Promise<{ items: GuestbookRecord[]; total: number }> {
		const statuses = Array.isArray(params.status) ? params.status : [params.status]
		const placeholders = statuses.map(() => '?').join(', ')
		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) AS cnt FROM guestbook_entries
			 WHERE deleted_at IS NULL AND status IN (${placeholders})`,
			statuses,
		)
		const total = countRow?.cnt ?? 0
		const offset = (params.page - 1) * params.pageSize
		const rows = await query<GuestbookRow>(
			`SELECT ${SELECT_COLS} FROM guestbook_entries
			 WHERE deleted_at IS NULL AND status IN (${placeholders})
			 ORDER BY created_at DESC
			 LIMIT ? OFFSET ?`,
			[...statuses, params.pageSize, offset],
		)
		return { items: rows.map(mapRow), total }
	},

	async approve(id: string, reviewerId: string): Promise<GuestbookRecord | null> {
		const result = await execute(
			`UPDATE guestbook_entries
			 SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?
			 WHERE id = ? AND deleted_at IS NULL AND status = 'pending'`,
			[reviewerId, id],
		)
		if (result.affectedRows === 0) return null
		return guestbookDal.findById(id)
	},

	/** 拒绝 = 标记 rejected 并软删除（不再公开展示） */
	async reject(id: string, reviewerId: string): Promise<boolean> {
		const result = await execute(
			`UPDATE guestbook_entries
			 SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ?, deleted_at = NOW()
			 WHERE id = ? AND deleted_at IS NULL AND status IN ('pending', 'approved')`,
			[reviewerId, id],
		)
		return result.affectedRows > 0
	},

	async softDelete(id: string): Promise<boolean> {
		const result = await execute(
			`UPDATE guestbook_entries SET deleted_at = NOW()
			 WHERE id = ? AND deleted_at IS NULL`,
			[id],
		)
		return result.affectedRows > 0
	},

	/** 同一 IP 在窗口内已提交条数（含 pending/approved/rejected，不含软删） */
	async countRecentByIp(ip: string, windowMs: number): Promise<number> {
		const row = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) AS cnt FROM guestbook_entries
			 WHERE ip = ? AND deleted_at IS NULL
			   AND created_at >= (NOW() - INTERVAL ? SECOND)`,
			[ip, Math.ceil(windowMs / 1000)],
		)
		return row?.cnt ?? 0
	},
}
