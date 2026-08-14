import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export type FileType = 'image' | 'video' | 'text' | 'other'

export type FileSortField = 'createdAt' | 'name' | 'size'

/** 排序字段白名单（防注入，仅允许映射内的列） */
const SORT_COLUMNS: Record<FileSortField, string> = {
	createdAt: 'created_at',
	name: 'original_name',
	size: 'size',
}

export interface FileRecord {
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
	folderId: string | null
	deletedAt: Date | null
	createdAt: Date
}

interface FileRow {
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
	folder_id: string | null
	deleted_at: Date | null
	created_at: Date
}

const mapRow = (row: FileRow): FileRecord => ({
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
	folderId: row.folder_id,
	deletedAt: row.deleted_at,
	createdAt: row.created_at,
})

/** 可在线预览的文本类型（md / txt 等） */
const TEXT_EXTS = new Set(['.md', '.markdown', '.txt', '.log', '.csv', '.json'])

export function isTextLike(mimeType: string, name: string): boolean {
	if (mimeType.startsWith('text/')) return true
	if (mimeType === 'application/json') return true
	const lower = name.toLowerCase()
	for (const ext of TEXT_EXTS) {
		if (lower.endsWith(ext)) return true
	}
	return false
}

/** 类型筛选对应的 SQL 条件（参数化） */
function typeCondition(type: FileType): { clause: string; values: string[] } {
	switch (type) {
		case 'image':
			return { clause: "mime_type LIKE 'image/%'", values: [] }
		case 'video':
			return { clause: "mime_type LIKE 'video/%'", values: [] }
		case 'text':
			return {
				clause: "(mime_type LIKE 'text/%' OR mime_type = 'application/json')",
				values: [],
			}
		case 'other':
			return {
				clause:
					"(mime_type NOT LIKE 'image/%' AND mime_type NOT LIKE 'video/%' AND mime_type NOT LIKE 'text/%' AND mime_type != 'application/json')",
				values: [],
			}
	}
}

export const fileDal = {
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
		folderId?: string | null
	}): Promise<FileRecord> {
		const id = generateId()
		await execute(
			`INSERT INTO files (id, user_id, original_name, filename, mime_type, size, width, height, cdn_url, thumbnail_url, file_hash, folder_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				data.folderId ?? null,
			],
		)
		const record = await fileDal.findById(id)
		if (!record) throw new Error('Failed to create file record')
		return record
	},

	async findById(id: string): Promise<FileRecord | null> {
		const row = await queryOne<FileRow>('SELECT * FROM files WHERE id = ? AND deleted_at IS NULL', [
			id,
		])
		return row ? mapRow(row) : null
	},

	async findByUserAndHash(userId: string, fileHash: string): Promise<FileRecord | null> {
		const row = await queryOne<FileRow>(
			'SELECT * FROM files WHERE user_id = ? AND file_hash = ? AND deleted_at IS NULL LIMIT 1',
			[userId, fileHash],
		)
		return row ? mapRow(row) : null
	},

	async listByUser(
		userId: string,
		params: {
			page: number
			pageSize: number
			keyword?: string
			folderId?: string | null
			type?: FileType
			sort?: FileSortField
			order?: 'asc' | 'desc'
		},
	): Promise<{ items: FileRecord[]; total: number }> {
		const conditions = ['user_id = ?', 'deleted_at IS NULL']
		const values: any[] = [userId]

		if (params.keyword) {
			// 搜索时全局匹配，不按文件夹过滤
			conditions.push('original_name LIKE ?')
			values.push(`%${params.keyword}%`)
		} else if (params.folderId) {
			conditions.push('folder_id = ?')
			values.push(params.folderId)
		} else {
			conditions.push('folder_id IS NULL')
		}

		if (params.type) {
			const { clause } = typeCondition(params.type)
			conditions.push(clause)
		}

		const where = `WHERE ${conditions.join(' AND ')}`

		const countRow = await queryOne<{ cnt: number }>(
			`SELECT COUNT(*) AS cnt FROM files ${where}`,
			values,
		)
		const total = countRow?.cnt ?? 0

		const offset = (params.page - 1) * params.pageSize
		const sortColumn = SORT_COLUMNS[params.sort ?? 'createdAt'] ?? SORT_COLUMNS.createdAt
		const sortOrder = params.order === 'asc' ? 'ASC' : 'DESC'
		const rows = await query<FileRow>(
			`SELECT * FROM files ${where} ORDER BY ${sortColumn} ${sortOrder}, id ASC LIMIT ? OFFSET ?`,
			[...values, params.pageSize, offset],
		)

		return { items: rows.map(mapRow), total }
	},

	async moveToFolder(id: string, userId: string, folderId: string | null): Promise<boolean> {
		const result = await execute(
			'UPDATE files SET folder_id = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
			[folderId, id, userId],
		)
		return result.affectedRows > 0
	},

	async rename(id: string, userId: string, name: string): Promise<boolean> {
		const result = await execute(
			'UPDATE files SET original_name = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
			[name, id, userId],
		)
		return result.affectedRows > 0
	},

	async softDelete(id: string, userId: string): Promise<boolean> {
		const result = await execute(
			'UPDATE files SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
			[id, userId],
		)
		return result.affectedRows > 0
	},

	async adminDelete(id: string): Promise<boolean> {
		const result = await execute(
			'UPDATE files SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
			[id],
		)
		return result.affectedRows > 0
	},

	/** 按文件夹集合软删（删除文件夹时级联） */
	async softDeleteByFolderIds(userId: string, folderIds: string[]): Promise<FileRecord[]> {
		if (folderIds.length === 0) return []
		const placeholders = folderIds.map(() => '?').join(',')
		const rows = await query<FileRow>(
			`SELECT * FROM files WHERE user_id = ? AND folder_id IN (${placeholders}) AND deleted_at IS NULL`,
			[userId, ...folderIds],
		)
		if (rows.length > 0) {
			await execute(
				`UPDATE files SET deleted_at = NOW() WHERE user_id = ? AND folder_id IN (${placeholders}) AND deleted_at IS NULL`,
				[userId, ...folderIds],
			)
		}
		return rows.map(mapRow)
	},

	async getUserStorageUsed(userId: string): Promise<number> {
		const row = await queryOne<{ total: number | null }>(
			'SELECT COALESCE(SUM(size), 0) AS total FROM files WHERE user_id = ? AND deleted_at IS NULL',
			[userId],
		)
		return row?.total ?? 0
	},

	async countByUser(userId: string): Promise<number> {
		const row = await queryOne<{ cnt: number }>(
			'SELECT COUNT(*) AS cnt FROM files WHERE user_id = ? AND deleted_at IS NULL',
			[userId],
		)
		return row?.cnt ?? 0
	},

	/** 全量图片记录（封禁扫描用，仅取必要字段） */
	async listAllImages(): Promise<
		Pick<FileRecord, 'id' | 'userId' | 'originalName' | 'filename' | 'mimeType' | 'cdnUrl'>[]
	> {
		const rows = await query<
			Pick<FileRow, 'id' | 'user_id' | 'original_name' | 'filename' | 'mime_type' | 'cdn_url'>
		>(
			"SELECT id, user_id, original_name, filename, mime_type, cdn_url FROM files WHERE mime_type LIKE 'image/%' AND deleted_at IS NULL",
		)
		return rows.map((row) => ({
			id: row.id,
			userId: row.user_id,
			originalName: row.original_name,
			filename: row.filename,
			mimeType: row.mime_type,
			cdnUrl: row.cdn_url,
		}))
	},
}
