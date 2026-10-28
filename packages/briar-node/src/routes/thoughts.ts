import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { thoughtDal } from '../dal/thoughtDal'
import { authService } from '../services/authService'
import { permissionService } from '../services/permissionService'

const thoughtRoutes = new Hono()

const MAX_BODY_LENGTH = 2000

type AuthedUser = { id: string }

function requireUser(c: Context): AuthedUser | null {
	return (c.get('user') as AuthedUser | undefined) ?? null
}

/** GET 公开路径跳过 authMiddleware，自行识别可选登录态 */
async function resolveUserId(c: Context): Promise<string | null> {
	const existing = c.get('user') as { id: string } | undefined
	if (existing?.id) return existing.id
	const token =
		c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || getCookie(c, 'briar_token')
	if (!token) return null
	const auth = await authService.verifyLoginToken(token)
	return auth ? auth.user.id : null
}

function toPublic(record: NonNullable<Awaited<ReturnType<typeof thoughtDal.findById>>>) {
	return {
		id: record.id,
		userId: record.userId,
		body: record.body,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		likeCount: record.likeCount,
		likedByMe: record.likedByMe,
		author: {
			id: record.userId,
			name: record.authorName,
			avatar: record.authorAvatar ?? undefined,
		},
	}
}

/** GET / — 想法列表（公开只读；登录则带 likedByMe） */
thoughtRoutes.get('/', async (c) => {
	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize')) || 20))
	const viewerId = await resolveUserId(c)
	const { items, total } = await thoughtDal.list({ page, pageSize, viewerId })
	return c.json<ApiResponse>({
		success: true,
		data: {
			items: items.map((t) => toPublic(t)),
			total,
			page,
			pageSize,
		},
	})
})

/** POST / — 发布想法（仅管理员） */
thoughtRoutes.post('/', async (c) => {
	const user = requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	if (!(await permissionService.isAdmin(user.id))) {
		return c.json<ApiResponse>(
			{ success: false, message: '仅管理员可发布想法' },
			HTTP_STATUS.FORBIDDEN,
		)
	}

	const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string })
	const text = typeof body.body === 'string' ? body.body.trim() : ''
	if (!text) {
		return c.json<ApiResponse>({ success: false, message: '内容不能为空' }, HTTP_STATUS.BAD_REQUEST)
	}
	if (text.length > MAX_BODY_LENGTH) {
		return c.json<ApiResponse>(
			{ success: false, message: `内容过长（最多 ${MAX_BODY_LENGTH} 字）` },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const created = await thoughtDal.create({ userId: user.id, body: text })
	return c.json<ApiResponse>({ success: true, data: toPublic(created) }, HTTP_STATUS.CREATED)
})

/** PUT /:id — 编辑自己的想法（仅管理员） */
thoughtRoutes.put('/:id', async (c) => {
	const user = requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	if (!(await permissionService.isAdmin(user.id))) {
		return c.json<ApiResponse>(
			{ success: false, message: '仅管理员可编辑想法' },
			HTTP_STATUS.FORBIDDEN,
		)
	}

	const id = c.req.param('id')
	const existing = await thoughtDal.findById(id, user.id)
	if (!existing) {
		return c.json<ApiResponse>({ success: false, message: '想法不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	if (existing.userId !== user.id) {
		return c.json<ApiResponse>(
			{ success: false, message: '只能编辑自己的想法' },
			HTTP_STATUS.FORBIDDEN,
		)
	}

	const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string })
	const text = typeof body.body === 'string' ? body.body.trim() : ''
	if (!text) {
		return c.json<ApiResponse>({ success: false, message: '内容不能为空' }, HTTP_STATUS.BAD_REQUEST)
	}
	if (text.length > MAX_BODY_LENGTH) {
		return c.json<ApiResponse>(
			{ success: false, message: `内容过长（最多 ${MAX_BODY_LENGTH} 字）` },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const updated = await thoughtDal.updateBody(id, user.id, text)
	if (!updated) {
		return c.json<ApiResponse>({ success: false, message: '更新失败' }, HTTP_STATUS.NOT_FOUND)
	}
	return c.json<ApiResponse>({ success: true, data: toPublic(updated) })
})

/** DELETE /:id — 软删除自己的想法（仅管理员） */
thoughtRoutes.delete('/:id', async (c) => {
	const user = requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	if (!(await permissionService.isAdmin(user.id))) {
		return c.json<ApiResponse>(
			{ success: false, message: '仅管理员可删除想法' },
			HTTP_STATUS.FORBIDDEN,
		)
	}

	const id = c.req.param('id')
	const existing = await thoughtDal.findById(id, user.id)
	if (!existing) {
		return c.json<ApiResponse>({ success: false, message: '想法不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	if (existing.userId !== user.id) {
		return c.json<ApiResponse>(
			{ success: false, message: '只能删除自己的想法' },
			HTTP_STATUS.FORBIDDEN,
		)
	}

	await thoughtDal.softDelete(id, user.id)
	return c.json<ApiResponse>({ success: true })
})

/** POST /:id/like — 点赞（需登录） */
thoughtRoutes.post('/:id/like', async (c) => {
	const user = requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	const id = c.req.param('id')
	const existing = await thoughtDal.findById(id, user.id)
	if (!existing) {
		return c.json<ApiResponse>({ success: false, message: '想法不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	const stats = await thoughtDal.like(id, user.id)
	return c.json<ApiResponse>({
		success: true,
		data: { likeCount: stats.likeCount, likedByMe: stats.liked },
	})
})

/** DELETE /:id/like — 取消点赞（需登录） */
thoughtRoutes.delete('/:id/like', async (c) => {
	const user = requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	const id = c.req.param('id')
	const existing = await thoughtDal.findById(id, user.id)
	if (!existing) {
		return c.json<ApiResponse>({ success: false, message: '想法不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	const stats = await thoughtDal.unlike(id, user.id)
	return c.json<ApiResponse>({
		success: true,
		data: { likeCount: stats.likeCount, likedByMe: stats.liked },
	})
})

export default thoughtRoutes
