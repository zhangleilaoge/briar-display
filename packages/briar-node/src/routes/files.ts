import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { generateId } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { type FileSortField, type FileType, fileDal, isTextLike } from '../dal/fileDal'
import { folderDal } from '../dal/folderDal'
import { cosService } from '../services/cosService'
import { permissionService } from '../services/permissionService'

const fileRoutes = new Hono()

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
const USER_QUOTA = 200 * 1024 * 1024 // 200MB
const ADMIN_QUOTA = 2 * 1024 * 1024 * 1024 // 2GB
const TEXT_PREVIEW_MAX_SIZE = 2 * 1024 * 1024 // 文本预览最大 2MB

type AuthedUser = { id: string }

function requireUser(c: Context): AuthedUser | null {
	return (c.get('user') as AuthedUser | undefined) ?? null
}

function unauthorized(c: Context) {
	return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
}

/** 从原始文件名提取安全的扩展名 */
function getExtFromName(name: string): string {
	const idx = name.lastIndexOf('.')
	if (idx < 0) return ''
	const ext = name.slice(idx).toLowerCase()
	return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ''
}

/** 删除 COS 对象（视频会连带封面图，best effort） */
async function deleteCosObjects(file: { filename: string; mimeType: string }) {
	await cosService.deleteFileWithCover(file.filename, file.mimeType)
}

/** 校验文件夹归属当前用户，返回文件夹或 null（根目录） */
async function validateFolder(userId: string, folderId?: string | null) {
	if (!folderId) return null
	const folder = await folderDal.findById(folderId)
	if (!folder || folder.userId !== userId) return undefined
	return folder
}

async function getQuota(userId: string) {
	const isAdmin = await permissionService.isAdmin(userId)
	return { quota: isAdmin ? ADMIN_QUOTA : USER_QUOTA, isAdmin }
}

/** POST /precheck — 直传前校验（配额/大小/文件夹/去重），分配 cosKey */
fileRoutes.post('/precheck', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{
		name?: string
		size?: number
		mimeType?: string
		folderId?: string | null
		fileHash?: string
	}>()

	const name = (body.name || '').trim()
	const size = Number(body.size) || 0
	const mimeType = body.mimeType || 'application/octet-stream'

	if (!name) {
		return c.json<ApiResponse>(
			{ success: false, message: '文件名不能为空' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	if (size <= 0) {
		return c.json<ApiResponse>({ success: false, message: '文件大小无效' }, HTTP_STATUS.BAD_REQUEST)
	}
	if (size > MAX_FILE_SIZE) {
		return c.json<ApiResponse>(
			{
				success: false,
				message: `文件过大: ${(size / 1024 / 1024).toFixed(1)}MB (最大 200MB)`,
			},
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	const folder = await validateFolder(user.id, body.folderId)
	if (folder === undefined) {
		return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 内容去重（仅当客户端提供了 hash）
	if (body.fileHash) {
		const existing = await fileDal.findByUserAndHash(user.id, body.fileHash)
		if (existing) {
			return c.json<ApiResponse>({ success: true, data: { deduplicated: true, file: existing } })
		}
	}

	// 配额校验
	const { quota, isAdmin } = await getQuota(user.id)
	const used = Number(await fileDal.getUserStorageUsed(user.id)) || 0
	if (used + size > quota) {
		console.warn('[Upload Quota]', { userId: user.id, used, newSize: size, quota, isAdmin, name })
		return c.json<ApiResponse>(
			{
				success: false,
				message: `存储空间不足。已用 ${(used / 1024 / 1024).toFixed(1)}MB，限额 ${isAdmin ? 2048 : 200}MB`,
			},
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	const cosKey = `files/${user.id}/${generateId()}${getExtFromName(name)}`
	const { bucket, region } = cosService.getBucketInfo()

	return c.json<ApiResponse>({
		success: true,
		data: { deduplicated: false, cosKey, bucket, region },
	})
})

/** POST /cos-sign — 为前端 cos-js-sdk-v5 的分片请求签名 */
fileRoutes.post('/cos-sign', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{
		method?: string
		key?: string
		query?: Record<string, string>
		headers?: Record<string, string>
	}>()

	const method = (body.method || '').toUpperCase()
	const key = body.key || ''

	if (!method) {
		return c.json<ApiResponse>({ success: false, message: '参数不完整' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 只允许签名当前用户自己的 files/{userId}/ 前缀。
	// key 为空时是 bucket 级请求（sliceUploadFile 续传检查：GET /?prefix=xxx&uploads），
	// 此时校验 query.prefix 前缀。
	const userPrefix = `files/${user.id}/`
	if (key) {
		if (!key.startsWith(userPrefix)) {
			return c.json<ApiResponse>(
				{ success: false, message: '无权操作该对象' },
				HTTP_STATUS.FORBIDDEN,
			)
		}
	} else if (!(body.query?.prefix || '').startsWith(userPrefix)) {
		return c.json<ApiResponse>({ success: false, message: '无权操作该对象' }, HTTP_STATUS.FORBIDDEN)
	}

	const authorization = cosService.getAuth({
		Method: method,
		Key: key,
		Query: body.query,
		Headers: body.headers,
	})

	return c.json<ApiResponse>({ success: true, data: { authorization } })
})

/** POST /confirm — 直传完成后写库 */
fileRoutes.post('/confirm', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{
		cosKey?: string
		name?: string
		mimeType?: string
		folderId?: string | null
		fileHash?: string
		thumbnailKey?: string
	}>()

	const cosKey = body.cosKey || ''
	const name = (body.name || '').trim()
	if (!cosKey.startsWith(`files/${user.id}/`) || !name) {
		return c.json<ApiResponse>({ success: false, message: '参数不完整' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 封面图 key（视频客户端截帧），同样限制在当前用户前缀下
	const thumbnailKey = body.thumbnailKey?.startsWith(`files/${user.id}/`)
		? body.thumbnailKey
		: undefined

	const folder = await validateFolder(user.id, body.folderId)
	if (folder === undefined) {
		return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 以 COS 上的实际对象为准
	let actualSize: number
	try {
		actualSize = await cosService.headObject(cosKey)
	} catch {
		return c.json<ApiResponse>(
			{ success: false, message: '文件尚未上传成功' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const { quota, isAdmin } = await getQuota(user.id)
	const used = Number(await fileDal.getUserStorageUsed(user.id)) || 0
	if (used + actualSize > quota) {
		// 清理已上传的对象
		try {
			await cosService.deleteObject(cosKey)
		} catch {
			/* best effort */
		}
		return c.json<ApiResponse>(
			{
				success: false,
				message: `存储空间不足。已用 ${(used / 1024 / 1024).toFixed(1)}MB，限额 ${isAdmin ? 2048 : 200}MB`,
			},
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	const mimeType = body.mimeType || 'application/octet-stream'
	const cdnUrl = cosService.getPublicUrl(cosKey)
	const thumbnailUrl = mimeType.startsWith('image/')
		? cosService.getThumbnailUrl(cdnUrl)
		: thumbnailKey
			? cosService.getPublicUrl(thumbnailKey)
			: undefined

	const record = await fileDal.create({
		userId: user.id,
		originalName: name,
		filename: cosKey,
		mimeType,
		size: actualSize,
		cdnUrl,
		thumbnailUrl,
		fileHash: body.fileHash,
		folderId: folder?.id ?? null,
	})

	return c.json<ApiResponse>({ success: true, data: record })
})

/** GET /stats — storage usage stats */
fileRoutes.get('/stats', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const { quota, isAdmin } = await getQuota(user.id)
	const used = await fileDal.getUserStorageUsed(user.id)
	const count = await fileDal.countByUser(user.id)

	return c.json<ApiResponse>({
		success: true,
		data: { used, quota, count, isAdmin },
	})
})

/** GET /folders — 当前用户全部文件夹（前端拼树/面包屑），fileCount 为直接文件数（不含子文件夹），previews 为直接图片/视频预览图（最多 3 张） */
fileRoutes.get('/folders', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const [folders, fileCounts, previewMap] = await Promise.all([
		folderDal.listByUser(user.id),
		folderDal.countFilesByFolder(user.id),
		folderDal.previewUrlsByFolder(user.id),
	])
	return c.json<ApiResponse>({
		success: true,
		data: folders.map((f) => ({
			...f,
			fileCount: fileCounts.get(f.id) ?? 0,
			previews: previewMap.get(f.id) ?? [],
		})),
	})
})

/** POST /folders — 新建文件夹 */
fileRoutes.post('/folders', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{ name?: string; parentId?: string | null }>()
	const name = (body.name || '').trim()
	if (!name) {
		return c.json<ApiResponse>(
			{ success: false, message: '文件夹名不能为空' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	if (name.length > 255 || name.includes('/') || name.includes('\\')) {
		return c.json<ApiResponse>(
			{ success: false, message: '文件夹名不合法' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const parent = await validateFolder(user.id, body.parentId)
	if (parent === undefined) {
		return c.json<ApiResponse>(
			{ success: false, message: '父文件夹不存在' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const folder = await folderDal.create({ userId: user.id, name, parentId: parent?.id ?? null })
	return c.json<ApiResponse>({ success: true, data: folder })
})

/** PATCH /folders/:id — 重命名 */
fileRoutes.patch('/folders/:id', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{ name?: string }>()
	const name = (body.name || '').trim()
	if (!name || name.length > 255 || name.includes('/') || name.includes('\\')) {
		return c.json<ApiResponse>(
			{ success: false, message: '文件夹名不合法' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const ok = await folderDal.rename(c.req.param('id'), user.id, name)
	if (!ok) {
		return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	return c.json<ApiResponse>({ success: true, message: '重命名成功' })
})

/** DELETE /folders/:id — 递归删除（含子文件夹与文件） */
fileRoutes.delete('/folders/:id', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const folderId = c.req.param('id')
	const folder = await folderDal.findById(folderId)
	if (!folder || folder.userId !== user.id) {
		return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.NOT_FOUND)
	}

	// 软删文件夹内（含子孙）全部文件
	const folderIds = await folderDal.collectDescendantIds(user.id, folderId)
	const files = await fileDal.softDeleteByFolderIds(user.id, folderIds)

	// 删除文件夹行（子文件夹通过 parent_id 外键级联删除）
	await folderDal.remove(folderId, user.id)

	// COS 对象删除（best effort，视频连带封面图）
	for (const file of files) {
		await deleteCosObjects(file)
	}

	return c.json<ApiResponse>({ success: true, message: `已删除文件夹及 ${files.length} 个文件` })
})

/** GET / — 文件列表（folderId / keyword / type / 分页） */
fileRoutes.get('/', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize')) || 24))
	const keyword = c.req.query('keyword') || undefined
	const folderId = c.req.query('folderId') || null
	const typeParam = c.req.query('type') || undefined
	const type = ['image', 'video', 'text', 'other'].includes(typeParam || '')
		? (typeParam as FileType)
		: undefined
	const sortParam = c.req.query('sort') || undefined
	const sort = ['createdAt', 'name', 'size'].includes(sortParam || '')
		? (sortParam as FileSortField)
		: undefined
	const order = c.req.query('order') === 'asc' ? ('asc' as const) : undefined

	const { items, total } = await fileDal.listByUser(user.id, {
		page,
		pageSize,
		keyword,
		folderId,
		type,
		sort,
		order,
	})

	return c.json<ApiResponse>({
		success: true,
		data: { items, total, page, pageSize },
	})
})

/** GET /:id — 文件详情 */
fileRoutes.get('/:id', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const file = await fileDal.findById(c.req.param('id'))
	if (!file) {
		return c.json<ApiResponse>({ success: false, message: '文件不存在' }, HTTP_STATUS.NOT_FOUND)
	}

	if (file.userId !== user.id) {
		const isAdmin = await permissionService.isAdmin(user.id)
		if (!isAdmin) {
			return c.json<ApiResponse>({ success: false, message: '无权访问' }, HTTP_STATUS.FORBIDDEN)
		}
	}

	return c.json<ApiResponse>({ success: true, data: file })
})

/** GET /:id/content — 文本内容预览代理（md / txt 等） */
fileRoutes.get('/:id/content', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const file = await fileDal.findById(c.req.param('id'))
	if (!file) {
		return c.json<ApiResponse>({ success: false, message: '文件不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	if (file.userId !== user.id) {
		const isAdmin = await permissionService.isAdmin(user.id)
		if (!isAdmin) {
			return c.json<ApiResponse>({ success: false, message: '无权访问' }, HTTP_STATUS.FORBIDDEN)
		}
	}

	if (!isTextLike(file.mimeType, file.originalName)) {
		return c.json<ApiResponse>(
			{ success: false, message: '该类型不支持文本预览' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	if (file.size > TEXT_PREVIEW_MAX_SIZE) {
		return c.json<ApiResponse>(
			{ success: false, message: '文件过大，请下载后查看' },
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	try {
		const buffer = await cosService.getObjectBuffer(file.filename, TEXT_PREVIEW_MAX_SIZE)
		return c.text(buffer.toString('utf-8'))
	} catch (err) {
		console.error('Read file content failed:', err)
		return c.json<ApiResponse>(
			{ success: false, message: '读取文件内容失败' },
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		)
	}
})

/** PATCH /:id — 移动文件夹 */
fileRoutes.patch('/:id', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{ folderId?: string | null }>()
	const folder = await validateFolder(user.id, body.folderId)
	if (folder === undefined) {
		return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.BAD_REQUEST)
	}

	const ok = await fileDal.moveToFolder(c.req.param('id'), user.id, folder?.id ?? null)
	if (!ok) {
		return c.json<ApiResponse>({ success: false, message: '文件不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	return c.json<ApiResponse>({ success: true, message: '移动成功' })
})

/** DELETE /:id — 删除文件 */
fileRoutes.delete('/:id', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const file = await fileDal.findById(c.req.param('id'))
	if (!file) {
		return c.json<ApiResponse>({ success: false, message: '文件不存在' }, HTTP_STATUS.NOT_FOUND)
	}

	if (file.userId !== user.id) {
		const isAdmin = await permissionService.isAdmin(user.id)
		if (!isAdmin) {
			return c.json<ApiResponse>({ success: false, message: '无权删除' }, HTTP_STATUS.FORBIDDEN)
		}
		await fileDal.adminDelete(file.id)
	} else {
		await fileDal.softDelete(file.id, user.id)
	}

	// Delete from COS (best effort，视频连带封面图)
	await deleteCosObjects(file)

	return c.json<ApiResponse>({ success: true, message: '删除成功' })
})

export default fileRoutes
