import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface ImageRecord {
	id: string
	userId: string
	originalName: string
	filename: string
	mimeType: string
	size: number
	width: number | null
	height: number | null
	cdnUrl: string
	thumbnailUrl: string | null
	fileHash: string | null
	deletedAt: Date | null
	createdAt: Date
}

interface ImageRow {
	id: string
	user_id: string
	original_name: string
	filename: string
	mime_type: string
	size: number
	width: number | null
	height: number | null
	cdn_url: string
	thumbnail_url: string | null
	file_hash: string | null
	deleted_at: Date | null
	created_at: Date
}

const mapRow = (row: ImageRow): ImageRecord => ({
	id: row.id,
	userId: row.user_id,
	originalName: row.original_name,
	filename: row.filename,
	mimeType: row.mime_type,
	size: row.size,
	width: row.width,
	height: row.height,
	cdnUrl: row.cdn_url,
	thumbnailUrl: row.thumbnail_url,
	fileHash: row.file_hash,
	deletedAt: row.deleted_at,
	createdAt: row.created_at,
})

export const imageDal = {
	async create(data: {
		userId: string
		originalName: string
		filename: string
		mimeType: string
		size: number
		width?: number
		height?: number
		cdnUrl: string
		thumbnailUrl?: string
		fileHash?: string
	}): Promise<ImageRecord> {
		const id = generateId()
		await execute(
			`INSERT INTO images (id, user_id, original_name, filename, mime_type, size, width, height, cdn_url, thumbnail_url, file_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				data.userId,
				data.originalName,
				data.filename,
				data.mimeType,
				data.size,
				data.width ?? null,
				data.height ?? null,
				data.cdnUrl,
				data.thumbnailUrl ?? null,
				data.fileHash ?? null,
			],
		)
		const record = await imageDal.findById(id)
		if (!record) throw new Error('Failed to create image record')
		return record
	},

	async findById(id: string): Promise<ImageRecord | null> {
		const row = await queryOne<ImageRow>(
			'SELECT * FROM images WHERE id = ? AND deleted_at IS NULL',
			[id],
		)
		return row ? mapRow(row) : null
	},

	async findByUserAndHash(userId: string, fileHash: string): Promise<ImageRecord | null> {
		const row = await queryOne<ImageRow>(
			'SELECT * FROM images WHERE user_id = ? AND file_hash = ? AND deleted_at IS NULL LIMIT 1',
			[userId, fileHash],
		)
		return row ? mapRow(row) : null
	},

	async listByUser(
		userId: string,
		params: { page: number; pageSize: number; keyword?: string },
	): Promise<{ items: ImageRecord[]; total: number }> {
		const conditions = ['user_id = ?', 'deleted_at IS NULL']
		const values: any[] = [userId]

		if (params.keyword) {
			conditions.push('original_name LIKE ?')
			values.push(`%${params.keyword}%`)
		}

		const where = `WHERE ${conditions.join(' AND ')}`

		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) AS cnt FROM images ${where}`,
			values,
		)
		const total = countRow?.cnt ?? 0

		const offset = (params.page - 1) * params.pageSize
		const rows = await query<ImageRow>(
			`SELECT * FROM images ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
			[...values, params.pageSize, offset],
		)

		return { items: rows.map(mapRow), total }
	},

	async softDelete(id: string, userId: string): Promise<boolean> {
		const result = await execute(
			'UPDATE images SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
			[id, userId],
		)
		return result.affectedRows > 0
	},

	async adminDelete(id: string): Promise<boolean> {
		const result = await execute(
			'UPDATE images SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
			[id],
		)
		return result.affectedRows > 0
	},

	async getUserStorageUsed(userId: string): Promise<number> {
		const row = await queryOne<{ total: number | null }>(
			'SELECT COALESCE(SUM(size), 0) AS total FROM images WHERE user_id = ? AND deleted_at IS NULL',
			[userId],
		)
		return row?.total ?? 0
	},

	async countByUser(userId: string): Promise<number> {
		const row = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM images WHERE user_id = ? AND deleted_at IS NULL',
			[userId],
		)
		return row?.cnt ?? 0
	},
}
