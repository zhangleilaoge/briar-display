import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiRevisionRecord {
	id: string
	pageId: string
	content: string
	summary: string | null
	editorId: string
	revisionNumber: number
	sizeBefore: number
	sizeAfter: number
	minorEdit: boolean
	createdAt: Date
}

interface WikiRevisionRow {
	id: string
	page_id: string
	content: string
	summary: string | null
	editor_id: string
	revision_number: number
	size_before: number
	size_after: number
	minor_edit: number
	created_at: Date
}

const mapRowToRecord = (row: WikiRevisionRow): WikiRevisionRecord => ({
	id: row.id,
	pageId: row.page_id,
	content: row.content,
	summary: row.summary,
	editorId: row.editor_id,
	revisionNumber: row.revision_number,
	sizeBefore: row.size_before,
	sizeAfter: row.size_after,
	minorEdit: !!row.minor_edit,
	createdAt: row.created_at,
})

const SELECT_FIELDS =
	'id, page_id, content, summary, editor_id, revision_number, size_before, size_after, minor_edit, created_at'

export const revisionDal = {
	async create(data: Omit<WikiRevisionRecord, 'id' | 'createdAt'>): Promise<WikiRevisionRecord> {
		const id = generateId()
		await execute(
			`INSERT INTO wiki_revisions (id, page_id, content, summary, editor_id, revision_number, size_before, size_after, minor_edit)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				data.pageId,
				data.content,
				data.summary,
				data.editorId,
				data.revisionNumber,
				data.sizeBefore,
				data.sizeAfter,
				data.minorEdit,
			],
		)

		const record = await revisionDal.findById(id)
		if (!record) {
			throw new Error('Failed to create revision')
		}
		return record
	},

	async listByPage(
		pageId: string,
		limit = 20,
		offset = 0,
	): Promise<{ items: WikiRevisionRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_revisions WHERE page_id = ?',
			[pageId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<WikiRevisionRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_revisions WHERE page_id = ? ORDER BY revision_number DESC LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[pageId],
		)

		return { items: rows.map(mapRowToRecord), total }
	},

	async findById(revId: string): Promise<WikiRevisionRecord | null> {
		const row = await queryOne<WikiRevisionRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_revisions WHERE id = ?`,
			[revId],
		)
		return row ? mapRowToRecord(row) : null
	},

	async getLatestRevisionNumber(pageId: string): Promise<number> {
		const row = await queryOne<{ max_rev: number | null }>(
			'SELECT MAX(revision_number) as max_rev FROM wiki_revisions WHERE page_id = ?',
			[pageId],
		)
		return row?.max_rev || 0
	},

	async getRevision(pageId: string, revisionNumber: number): Promise<WikiRevisionRecord | null> {
		const row = await queryOne<WikiRevisionRow>(
			`SELECT ${SELECT_FIELDS} FROM wiki_revisions WHERE page_id = ? AND revision_number = ?`,
			[pageId, revisionNumber],
		)
		return row ? mapRowToRecord(row) : null
	},
}
