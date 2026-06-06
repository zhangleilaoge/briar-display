import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../../lib/db'

export interface WikiDiscussionRecord {
	id: string
	pageId: string
	title: string
	authorId: string
	resolved: boolean
	createdAt: Date
	replyCount?: number
}

interface WikiDiscussionRow {
	id: string
	page_id: string
	title: string
	author_id: string
	resolved: number
	created_at: Date
	reply_count?: number
}

export interface WikiDiscussionReplyRecord {
	id: string
	topicId: string
	content: string
	authorId: string
	parentReplyId: string | null
	createdAt: Date
}

interface WikiDiscussionReplyRow {
	id: string
	topic_id: string
	content: string
	author_id: string
	parent_reply_id: string | null
	created_at: Date
}

const mapDiscussionToRecord = (row: WikiDiscussionRow): WikiDiscussionRecord => ({
	id: row.id,
	pageId: row.page_id,
	title: row.title,
	authorId: row.author_id,
	resolved: !!row.resolved,
	createdAt: row.created_at,
	replyCount: row.reply_count,
})

const mapReplyToRecord = (row: WikiDiscussionReplyRow): WikiDiscussionReplyRecord => ({
	id: row.id,
	topicId: row.topic_id,
	content: row.content,
	authorId: row.author_id,
	parentReplyId: row.parent_reply_id,
	createdAt: row.created_at,
})

const DISCUSSION_FIELDS = 'd.id, d.page_id, d.title, d.author_id, d.resolved, d.created_at'
const REPLY_FIELDS = 'id, topic_id, content, author_id, parent_reply_id, created_at'

export const discussionDal = {
	async create(
		data: Omit<WikiDiscussionRecord, 'id' | 'createdAt' | 'resolved' | 'replyCount'>,
	): Promise<WikiDiscussionRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO wiki_discussions (id, page_id, title, author_id) VALUES (?, ?, ?, ?)',
			[id, data.pageId, data.title, data.authorId],
		)

		const record = await discussionDal.findById(id)
		if (!record) {
			throw new Error('Failed to create discussion')
		}
		return record
	},

	async listByPage(
		pageId: string,
		limit = 20,
		offset = 0,
	): Promise<{ items: WikiDiscussionRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_discussions WHERE page_id = ?',
			[pageId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<WikiDiscussionRow>(
			`SELECT ${DISCUSSION_FIELDS},
				(SELECT COUNT(*) FROM wiki_discussion_replies WHERE topic_id = d.id) as reply_count
			FROM wiki_discussions d
			WHERE d.page_id = ?
			ORDER BY d.created_at DESC
			LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[pageId],
		)

		return { items: rows.map(mapDiscussionToRecord), total }
	},

	async findById(topicId: string): Promise<WikiDiscussionRecord | null> {
		const row = await queryOne<WikiDiscussionRow>(
			`SELECT ${DISCUSSION_FIELDS},
				(SELECT COUNT(*) FROM wiki_discussion_replies WHERE topic_id = d.id) as reply_count
			FROM wiki_discussions d
			WHERE d.id = ?`,
			[topicId],
		)
		return row ? mapDiscussionToRecord(row) : null
	},

	async createReply(
		data: Omit<WikiDiscussionReplyRecord, 'id' | 'createdAt'>,
	): Promise<WikiDiscussionReplyRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO wiki_discussion_replies (id, topic_id, content, author_id, parent_reply_id) VALUES (?, ?, ?, ?, ?)',
			[id, data.topicId, data.content, data.authorId, data.parentReplyId],
		)

		const record = await discussionDal.findReplyById(id)
		if (!record) {
			throw new Error('Failed to create reply')
		}
		return record
	},

	async findReplyById(replyId: string): Promise<WikiDiscussionReplyRecord | null> {
		const row = await queryOne<WikiDiscussionReplyRow>(
			`SELECT ${REPLY_FIELDS} FROM wiki_discussion_replies WHERE id = ?`,
			[replyId],
		)
		return row ? mapReplyToRecord(row) : null
	},

	async getReplies(
		topicId: string,
		limit = 50,
		offset = 0,
	): Promise<{ items: WikiDiscussionReplyRecord[]; total: number }> {
		const countRow = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_discussion_replies WHERE topic_id = ?',
			[topicId],
		)
		const total = countRow?.cnt || 0

		const rows = await query<WikiDiscussionReplyRow>(
			`SELECT ${REPLY_FIELDS} FROM wiki_discussion_replies WHERE topic_id = ? ORDER BY created_at ASC LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
			[topicId],
		)
		return { items: rows.map(mapReplyToRecord), total }
	},

	async markResolved(topicId: string): Promise<boolean> {
		const result = await execute('UPDATE wiki_discussions SET resolved = TRUE WHERE id = ?', [
			topicId,
		])
		return result.affectedRows > 0
	},

	async countByPage(pageId: string): Promise<number> {
		const row = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) as cnt FROM wiki_discussions WHERE page_id = ?',
			[pageId],
		)
		return row?.cnt || 0
	},
}
