import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { thoughtDal } from '../dal/thoughtDal'
import { permissionService } from '../services/permissionService'

const thoughtRoutes = new Hono()

const MAX_BODY_LENGTH = 2000

type AuthedUser = { id: string }

function requireUser(c: Context): AuthedUser | null {
	return (c.get('user') as AuthedUser | undefined) ?? null
}

function toPublic(record: Awaited<ReturnType<typeof thoughtDal.findById>>) {
	if (!record) return null
	return {
		id: record.id,
		userId: record.userId,
		body: record.body,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		author: {
			id: record.userId,
			name: record.authorName,
			avatar: record.authorAvatar ?? undefined,
		},
	}
}

/** GET / — 想法列表（公开只读） */
thoughtRoutes.get('/', async (c) => {
	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize')) || 20))
	const { items, total } = await thoughtDal.list({ page, pageSize })
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

	const body = await c.req.json<{ body?: string }>().catch(() => ({} as { body?: string }))
	const text = typeof body.body === 'string' ? body.body.trim() : ''
	if (!text) {
		return c.json<ApiResponse>(
			{ success: false, message: '内容不能为空' },
			HTTP_STATUS.BAD_REQUEST,
		)
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
	const existing = await thoughtDal.findById(id)
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

export default thoughtRoutes
