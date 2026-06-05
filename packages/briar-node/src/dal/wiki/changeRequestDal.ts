import { generateId } from '@briar/shared'
import type { WikiChangeRequestStatus } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiChangeRequestRecord {
	id: string
	pageId: string
	title: string | null
	content: string | null
	summary: string | null
	status: WikiChangeRequestStatus
	requesterId: string
	reviewerId: string | null
	reviewComment: string | null
	createdAt: Date
	updatedAt: Date
	reviewedAt: Date | null
}

interface WikiChangeRequestRow {
	id: string
	page_id: string
	title: string | null
	content: string | null
	summary: string | null
	status: WikiChangeRequestStatus
	requester_id: string
	reviewer_id: string | null
	review_comment: string | null
	created_at: Date
	updated_at: Date
	reviewed_at: Date | null
}

const mapRowToRecord = (row: WikiChangeRequestRow): WikiChangeRequestRecord => ({
	id: row.id,
	pageId: row.page_id,
	title: row.title,
	content: row.content,
	summary: row.summary,
	status: row.status,
	requesterId: row.requester_id,
	reviewerId: row.reviewer_id,
	reviewComment: row.review_comment,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	reviewedAt: row.reviewed_at,
})

const SELECT_FIELDS =
	'id, page_id, title, content, summary, status, requester_id, reviewer_id, review_comment, created_at, updated_at, reviewed_at'

export const changeRequestDal = {
	async create(data: {
		pageId: string
		title?: string
		content?: string
		summary?: string
		requesterId: string
	}): Promise<WikiChangeRequestRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO wiki_change_requests (id, page_id, title, content, summary, requester_id) VALUES (?, ?, ?, ?, ?, ?)',
			[
				id,
				data.pageId,
				data.title || null,
				data.content || null,
				data.summary || null,
				data.requesterId,
			],
		)

		const record = await changeRequestDal.findById(id)
		if (!record) {
			throw new Error('Failed to create change request')
		}
		return record
	},

	async findById(id: string): Promise<WikiChangeRequestRecord | null> {
		const row = await queryOne<WikiChangeRequestRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_change_requests WHERE id = ?`,
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async listByPage(
		pageId: string,
		status?: WikiChangeRequestStatus,
	): Promise<WikiChangeRequestRecord[]> {
		let sql = `SELECT ${SELECT_FIELDS} FROM wiki_change_requests WHERE page_id = ?`
		const values: any[] = [pageId]

		if (status) {
			sql += ' AND status = ?'
			values.push(status)
		}

		sql += ' ORDER BY created_at DESC'

		const rows = await query<WikiChangeRequestRow>(sql, values)
		return rows.map(mapRowToRecord)
	},

	async listByRequester(requesterId: string): Promise<WikiChangeRequestRecord[]> {
		const rows = await query<WikiChangeRequestRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_change_requests WHERE requester_id = ? ORDER BY created_at DESC`,
			[requesterId],
		)
		return rows.map(mapRowToRecord)
	},

	async listPendingForReviewer(pageId?: string): Promise<WikiChangeRequestRecord[]> {
		let sql = `SELECT ${SELECT_FIELDS} FROM wiki_change_requests WHERE status = 'pending'`
		const values: any[] = []

		if (pageId) {
			sql += ' AND page_id = ?'
			values.push(pageId)
		}

		sql += ' ORDER BY created_at DESC'

		const rows = await query<WikiChangeRequestRow>(sql, values)
		return rows.map(mapRowToRecord)
	},

	async updateStatus(
		id: string,
		status: WikiChangeRequestStatus,
		reviewerId: string,
		comment?: string,
	): Promise<WikiChangeRequestRecord | null> {
		await execute(
			'UPDATE wiki_change_requests SET status = ?, reviewer_id = ?, review_comment = ?, reviewed_at = NOW() WHERE id = ?',
			[status, reviewerId, comment || null, id],
		)
		return changeRequestDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM wiki_change_requests WHERE id = ?', [id])
		return result.affectedRows > 0
	},
}
