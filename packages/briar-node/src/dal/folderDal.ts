import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface FolderRecord {
	id: string
	userId: string
	name: string
	parentId: string | null
	createdAt: Date
}

export interface FolderPreview {
	url: string
	/** true 表示无封面视频（url 为视频本身），前端用 <video preload="metadata"> 取首帧兜底 */
	isVideo: boolean
}

interface FolderRow {
	id: string
	user_id: string
	name: string
	parent_id: string | null
	created_at: Date
}

const mapRow = (row: FolderRow): FolderRecord => ({
	id: row.id,
	userId: row.user_id,
	name: row.name,
	parentId: row.parent_id,
	createdAt: row.created_at,
})

export const folderDal = {
	async create(data: {
		userId: string
		name: string
		parentId?: string | null
	}): Promise<FolderRecord> {
		const id = generateId()
		await execute('INSERT INTO folders (id, user_id, name, parent_id) VALUES (?, ?, ?, ?)', [
			id,
			data.userId,
			data.name,
			data.parentId ?? null,
		])
		const record = await folderDal.findById(id)
		if (!record) throw new Error('Failed to create folder')
		return record
	},

	async findById(id: string): Promise<FolderRecord | null> {
		const row = await queryOne<FolderRow>('SELECT * FROM folders WHERE id = ?', [id])
		return row ? mapRow(row) : null
	},

	async listByUser(userId: string): Promise<FolderRecord[]> {
		const rows = await query<FolderRow>(
			'SELECT * FROM folders WHERE user_id = ? ORDER BY created_at ASC',
			[userId],
		)
		return rows.map(mapRow)
	},

	/** 各文件夹的直接文件数（不含子文件夹；folder_id -> count） */
	async countFilesByFolder(userId: string): Promise<Map<string, number>> {
		const rows = await query<{ folder_id: string; cnt: number | string }>(
			'SELECT folder_id, COUNT(*) AS cnt FROM files WHERE user_id = ? AND deleted_at IS NULL AND folder_id IS NOT NULL GROUP BY folder_id',
			[userId],
		)
		return new Map(rows.map((r) => [r.folder_id, Number(r.cnt)]))
	},

	/** 各文件夹的图片/视频预览（直接文件；每文件夹最多 perFolder 张，新的在前） */
	async previewUrlsByFolder(userId: string, perFolder = 3): Promise<Map<string, FolderPreview[]>> {
		const rows = await query<{ folder_id: string; url: string; is_video: number }>(
			`SELECT folder_id, COALESCE(thumbnail_url, cdn_url) AS url,
			        (mime_type LIKE 'video/%' AND thumbnail_url IS NULL) AS is_video
			 FROM files
			 WHERE user_id = ? AND deleted_at IS NULL AND folder_id IS NOT NULL
			   AND (mime_type LIKE 'image/%' OR mime_type LIKE 'video/%')
			 ORDER BY created_at DESC`,
			[userId],
		)
		const map = new Map<string, FolderPreview[]>()
		for (const row of rows) {
			const item: FolderPreview = { url: row.url, isVideo: Boolean(row.is_video) }
			const list = map.get(row.folder_id)
			if (list) {
				if (list.length < perFolder) list.push(item)
			} else {
				map.set(row.folder_id, [item])
			}
		}
		return map
	},

	async rename(id: string, userId: string, name: string): Promise<boolean> {
		const result = await execute('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?', [
			name,
			id,
			userId,
		])
		return result.affectedRows > 0
	},

	async remove(id: string, userId: string): Promise<boolean> {
		const result = await execute('DELETE FROM folders WHERE id = ? AND user_id = ?', [id, userId])
		return result.affectedRows > 0
	},

	/** 收集目标文件夹及其全部子孙文件夹 id（含自身） */
	async collectDescendantIds(userId: string, folderId: string): Promise<string[]> {
		const all = await folderDal.listByUser(userId)
		const childrenMap = new Map<string | null, FolderRecord[]>()
		for (const f of all) {
			const list = childrenMap.get(f.parentId) || []
			list.push(f)
			childrenMap.set(f.parentId, list)
		}
		const ids: string[] = []
		const queue = [folderId]
		while (queue.length > 0) {
			const current = queue.shift()!
			ids.push(current)
			for (const child of childrenMap.get(current) || []) {
				queue.push(child.id)
			}
		}
		return ids
	},
}
