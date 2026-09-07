import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { Hono } from 'hono'
import { type FileSortField, type FileType, fileDal, isTextLike } from '../dal/fileDal'
import { folderDal } from '../dal/folderDal'
import { cosService } from '../services/cosService'
import { permissionService } from '../services/permissionService'
import { privacyService } from '../services/privacyService'
import { guardPrivateChain, hasPrivacyUnlock, privacyLocked } from './filePrivacy'
import {
	deleteCosObjects,
	getQuota,
	requireUser,
	unauthorized,
	validateFolder,
} from './filesShared'

const fileRoutes = new Hono()

const TEXT_PREVIEW_MAX_SIZE = 2 * 1024 * 1024 // 文本预览最大 2MB

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

/** GET /folders — 当前用户全部文件夹（前端拼树/面包屑），fileCount 为直接文件数（不含子文件夹），previews 为直接图片/视频预览（最多 3 张，私有桶签名 URL；isVideo=true 为无封面视频，前端用 video 首帧兜底）。isPrivate 始终返回；未解锁时隐私链路文件夹 previews 置空 */
fileRoutes.get('/folders', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const [folders, fileCounts, previewMap, privateScope] = await Promise.all([
		folderDal.listByUser(user.id),
		folderDal.countFilesByFolder(user.id),
		folderDal.previewFilesByFolder(user.id),
		privacyService.privateScopeFolderIds(user.id),
	])
	const unlocked = hasPrivacyUnlock(c, user.id)
	const privateSet = new Set(privateScope)
	return c.json<ApiResponse>({
		success: true,
		data: folders.map((f) => ({
			...f,
			fileCount: fileCounts.get(f.id) ?? 0,
			previews:
				!unlocked && privateSet.has(f.id)
					? []
					: (previewMap.get(f.id) ?? []).map((p) => {
							const signed = cosService.signFileUrls({
								filename: p.filename,
								mimeType: p.mimeType,
								thumbnailUrl: p.hasCover ? 'cover' : null,
							})
							return { url: signed.thumbnailUrl ?? signed.cdnUrl, isVideo: p.isVideo }
						}),
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

	// 在隐私链路内新建子文件夹需先解锁
	const denied = await guardPrivateChain(c, user.id, parent?.id)
	if (denied) return denied

	const folder = await folderDal.create({ userId: user.id, name, parentId: parent?.id ?? null })
	return c.json<ApiResponse>({ success: true, data: folder })
})

/** PATCH /folders/:id — 重命名（name）或设置/取消隐私（isPrivate） */
fileRoutes.patch('/folders/:id', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const folderId = c.req.param('id')
	const body = await c.req.json<{ name?: string; isPrivate?: boolean }>()

	// 隐私链路上的文件夹：重命名/取消隐私均需先解锁
	const denied = await guardPrivateChain(c, user.id, folderId)
	if (denied) return denied

	if (body.isPrivate !== undefined) {
		// 设/取消隐私都必须已解锁（上面 guard 只拦链路内；设为隐私针对的是非链路文件夹，需显式校验）
		if (!hasPrivacyUnlock(c, user.id)) return privacyLocked(c)
		if (body.isPrivate) {
			const error = await privacyService.validateSetPrivate(user.id, folderId)
			if (error) {
				return c.json<ApiResponse>({ success: false, message: error }, HTTP_STATUS.BAD_REQUEST)
			}
		}
		const ok = await folderDal.setPrivacy(folderId, user.id, body.isPrivate)
		if (!ok) {
			return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.NOT_FOUND)
		}
		return c.json<ApiResponse>({
			success: true,
			message: body.isPrivate ? '已设为隐私文件夹' : '已取消隐私',
		})
	}

	const name = (body.name || '').trim()
	if (!name || name.length > 255 || name.includes('/') || name.includes('\\')) {
		return c.json<ApiResponse>(
			{ success: false, message: '文件夹名不合法' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const ok = await folderDal.rename(folderId, user.id, name)
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

	// 隐私链路上的文件夹删除需先解锁
	const denied = await guardPrivateChain(c, user.id, folderId)
	if (denied) return denied

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

	// 进入隐私链路文件夹需先解锁；搜索时未解锁则排除隐私链路文件
	let excludeFolderIds: string[] | undefined
	if (folderId) {
		const denied = await guardPrivateChain(c, user.id, folderId)
		if (denied) return denied
	} else if (keyword && !hasPrivacyUnlock(c, user.id)) {
		excludeFolderIds = await privacyService.privateScopeFolderIds(user.id)
	}

	const { items, total } = await fileDal.listByUser(user.id, {
		page,
		pageSize,
		keyword,
		folderId,
		excludeFolderIds,
		type,
		sort,
		order,
	})

	// 私有桶：对外一律返回签名 URL（按 filename 现算，不用 DB 留存的裸 URL）
	return c.json<ApiResponse>({
		success: true,
		data: {
			items: items.map((f) => ({ ...f, ...cosService.signFileUrls(f) })),
			total,
			page,
			pageSize,
		},
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
	} else {
		// 本人文件：隐私链路内未解锁不签发 URL（管理员查看他人文件维持现状，不受隐私限制）
		const denied = await guardPrivateChain(c, user.id, file.folderId)
		if (denied) return denied
	}

	return c.json<ApiResponse>({
		success: true,
		data: { ...file, ...cosService.signFileUrls(file) },
	})
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
	} else {
		const denied = await guardPrivateChain(c, user.id, file.folderId)
		if (denied) return denied
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

/** PATCH /:id — 移动文件夹（folderId）或重命名（name） */
fileRoutes.patch('/:id', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{ folderId?: string | null; name?: string }>()

	const file = await fileDal.findById(c.req.param('id'))
	if (!file || file.userId !== user.id) {
		return c.json<ApiResponse>({ success: false, message: '文件不存在' }, HTTP_STATUS.NOT_FOUND)
	}

	// 隐私链路内文件的重命名/移动需先解锁
	const denied = await guardPrivateChain(c, user.id, file.folderId)
	if (denied) return denied

	if (body.name !== undefined) {
		const name = body.name.trim()
		if (!name || name.length > 255 || name.includes('/') || name.includes('\\')) {
			return c.json<ApiResponse>(
				{ success: false, message: '文件名不合法' },
				HTTP_STATUS.BAD_REQUEST,
			)
		}
		const ok = await fileDal.rename(c.req.param('id'), user.id, name)
		if (!ok) {
			return c.json<ApiResponse>({ success: false, message: '文件不存在' }, HTTP_STATUS.NOT_FOUND)
		}
		return c.json<ApiResponse>({ success: true, message: '重命名成功' })
	}

	const folder = await validateFolder(user.id, body.folderId)
	if (folder === undefined) {
		return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 移入隐私链路文件夹需先解锁（移出隐私链路 = 解除保护，已解锁即可）
	const deniedTarget = await guardPrivateChain(c, user.id, folder?.id)
	if (deniedTarget) return deniedTarget

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
		// 隐私链路内文件删除需先解锁
		const denied = await guardPrivateChain(c, user.id, file.folderId)
		if (denied) return denied
		await fileDal.softDelete(file.id, user.id)
	}

	// Delete from COS (best effort，视频连带封面图)
	await deleteCosObjects(file)

	return c.json<ApiResponse>({ success: true, message: '删除成功' })
})

export default fileRoutes
