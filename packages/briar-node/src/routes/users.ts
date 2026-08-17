import type { ApiResponse, User } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { generateId } from '@briar/shared'
import { Hono } from 'hono'
import { userDal } from '../dal/userDal'
import { cosService } from '../services/cosService'
import { permissionService } from '../services/permissionService'

const userRoutes = new Hono()

const ALLOWED_AVATAR_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
])
const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2MB

function getExt(mimeType: string): string {
	const map: Record<string, string> = {
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/webp': '.webp',
		'image/avif': '.avif',
	}
	return map[mimeType] || '.bin'
}

const toPublicUser = (record: Awaited<ReturnType<typeof userDal.findById>>): User | null => {
	if (!record) return null
	return {
		id: record.id,
		name: record.name,
		email: record.email,
		avatar: record.avatar ?? undefined,
		createdAt: record.createdAt,
	}
}

/** GET /me — 获取当前登录用户资料 */
userRoutes.get('/me', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const record = await userDal.findById(user.id)
	if (!record) {
		return c.json<ApiResponse>({ success: false, message: '用户不存在' }, HTTP_STATUS.NOT_FOUND)
	}

	return c.json<ApiResponse>({ success: true, data: toPublicUser(record) })
})

/** PUT /me — 更新当前用户资料（name / avatar） */
userRoutes.put('/me', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const body = await c.req.json<{ name?: string; avatar?: string }>()

	if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
		return c.json<ApiResponse>(
			{ success: false, message: '用户名不能为空' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const updateData: Partial<{ name: string; avatar: string }> = {}
	if (body.name !== undefined) updateData.name = body.name.trim()
	if (body.avatar !== undefined) updateData.avatar = body.avatar.trim()

	const updated = await userDal.update(user.id, updateData)
	if (!updated) {
		return c.json<ApiResponse>({ success: false, message: '更新失败' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 清除权限缓存，确保用户资料变更后拉取最新信息
	permissionService.invalidateCache(user.id)

	return c.json<ApiResponse>({ success: true, data: toPublicUser(updated) })
})

/** POST /me/avatar — 上传头像 */
userRoutes.post('/me/avatar', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const formData = await c.req.formData()
	const file = formData.get('file')

	if (!(file instanceof File)) {
		return c.json<ApiResponse>(
			{ success: false, message: '请选择图片文件' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
		return c.json<ApiResponse>(
			{ success: false, message: `不支持的图片格式: ${file.type}` },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	if (file.size > MAX_AVATAR_SIZE) {
		return c.json<ApiResponse>(
			{
				success: false,
				message: `头像过大: ${(file.size / 1024 / 1024).toFixed(1)}MB（最大 2MB）`,
			},
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	const ext = getExt(file.type)
	const uuid = generateId()
	const cosKey = `avatars/${user.id}/${uuid}${ext}`

	const buffer = Buffer.from(await file.arrayBuffer())
	const cdnUrl = await cosService.uploadBuffer(buffer, cosKey, file.type)

	// 可选：删除旧头像（异步，失败不影响更新）
	const oldUser = await userDal.findById(user.id)
	if (oldUser?.avatar) {
		try {
			const oldKey = oldUser.avatar.split('/').slice(-3).join('/')
			if (oldKey.startsWith('avatars/')) {
				await cosService.deletePublicObject(oldKey)
			}
		} catch {
			// 旧头像删除失败不影响新头像保存
		}
	}

	const updated = await userDal.update(user.id, { avatar: cdnUrl })
	if (!updated) {
		return c.json<ApiResponse>({ success: false, message: '头像保存失败' }, HTTP_STATUS.BAD_REQUEST)
	}

	permissionService.invalidateCache(user.id)

	return c.json<ApiResponse>({ success: true, data: toPublicUser(updated) })
})

export default userRoutes
