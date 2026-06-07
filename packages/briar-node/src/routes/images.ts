import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { generateId } from '@briar/shared'
import { Hono } from 'hono'
import { imageDal } from '../dal/imageDal'
import { cosService } from '../services/cosService'
import { permissionService } from '../services/permissionService'

const imageRoutes = new Hono()

const ALLOWED_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/svg+xml',
	'image/bmp',
])
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const USER_QUOTA = 200 * 1024 * 1024 // 200MB
const ADMIN_QUOTA = 2 * 1024 * 1024 * 1024 // 2GB

function getExt(mimeType: string): string {
	const map: Record<string, string> = {
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/webp': '.webp',
		'image/avif': '.avif',
		'image/svg+xml': '.svg',
		'image/bmp': '.bmp',
	}
	return map[mimeType] || '.bin'
}

/** POST /upload — multipart file upload */
imageRoutes.post('/upload', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const formData = await c.req.formData()
	const entries = formData.getAll('file')
	const files: File[] = []
	for (const entry of entries) {
		if (entry instanceof File) files.push(entry)
	}

	if (files.length === 0) {
		return c.json<ApiResponse>({ success: false, message: '请选择文件' }, HTTP_STATUS.BAD_REQUEST)
	}

	// Check quota
	const isAdmin = await permissionService.isAdmin(user.id)
	const quota = isAdmin ? ADMIN_QUOTA : USER_QUOTA
	const used = await imageDal.getUserStorageUsed(user.id)
	const newTotal = files.reduce((sum, f) => sum + f.size, 0)

	if (used + newTotal > quota) {
		return c.json<ApiResponse>(
			{
				success: false,
				message: `存储空间不足。已用 ${(used / 1024 / 1024).toFixed(1)}MB，限额 ${isAdmin ? 2048 : 200}MB`,
			},
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	const results: any[] = []

	for (const file of files) {
		// Validate type
		if (!ALLOWED_TYPES.has(file.type)) {
			results.push({ name: file.name, error: `不支持的文件类型: ${file.type}` })
			continue
		}
		// Validate size
		if (file.size > MAX_FILE_SIZE) {
			results.push({
				name: file.name,
				error: `文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB (最大 10MB)`,
			})
			continue
		}

		const ext = getExt(file.type)
		const uuid = generateId()
		const cosKey = `images/${user.id}/${uuid}${ext}`

		const buffer = Buffer.from(await file.arrayBuffer())
		const cdnUrl = await cosService.uploadBuffer(buffer, cosKey, file.type)
		const thumbnailUrl = cosService.getThumbnailUrl(cdnUrl)

		const record = await imageDal.create({
			userId: user.id,
			originalName: file.name,
			filename: cosKey,
			mimeType: file.type,
			size: file.size,
			cdnUrl,
			thumbnailUrl,
		})

		results.push({
			id: record.id,
			originalName: record.originalName,
			cdnUrl: record.cdnUrl,
			thumbnailUrl: record.thumbnailUrl,
			size: record.size,
			mimeType: record.mimeType,
			createdAt: record.createdAt,
		})
	}

	return c.json<ApiResponse>({ success: true, data: results })
})

/** GET / — list current user's images */
imageRoutes.get('/', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize')) || 24))
	const keyword = c.req.query('keyword') || undefined

	const { items, total } = await imageDal.listByUser(user.id, { page, pageSize, keyword })

	return c.json<ApiResponse>({
		success: true,
		data: { items, total, page, pageSize },
	})
})

/** GET /stats — storage usage stats */
imageRoutes.get('/stats', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const isAdmin = await permissionService.isAdmin(user.id)
	const quota = isAdmin ? ADMIN_QUOTA : USER_QUOTA
	const used = await imageDal.getUserStorageUsed(user.id)
	const count = await imageDal.countByUser(user.id)

	return c.json<ApiResponse>({
		success: true,
		data: { used, quota, count, isAdmin },
	})
})

/** GET /:id — image detail */
imageRoutes.get('/:id', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const image = await imageDal.findById(c.req.param('id'))
	if (!image) {
		return c.json<ApiResponse>({ success: false, message: '图片不存在' }, HTTP_STATUS.NOT_FOUND)
	}

	// Non-admin can only view own images
	if (image.userId !== user.id) {
		const isAdmin = await permissionService.isAdmin(user.id)
		if (!isAdmin) {
			return c.json<ApiResponse>({ success: false, message: '无权访问' }, HTTP_STATUS.FORBIDDEN)
		}
	}

	return c.json<ApiResponse>({ success: true, data: image })
})

/** DELETE /:id — delete image */
imageRoutes.delete('/:id', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const image = await imageDal.findById(c.req.param('id'))
	if (!image) {
		return c.json<ApiResponse>({ success: false, message: '图片不存在' }, HTTP_STATUS.NOT_FOUND)
	}

	// Non-admin can only delete own images
	if (image.userId !== user.id) {
		const isAdmin = await permissionService.isAdmin(user.id)
		if (!isAdmin) {
			return c.json<ApiResponse>({ success: false, message: '无权删除' }, HTTP_STATUS.FORBIDDEN)
		}
		await imageDal.adminDelete(image.id)
	} else {
		await imageDal.softDelete(image.id, user.id)
	}

	// Delete from COS (best effort)
	try {
		await cosService.deleteObject(image.filename)
	} catch (err) {
		console.error('COS delete failed:', err)
	}

	return c.json<ApiResponse>({ success: true, message: '删除成功' })
})

export default imageRoutes
