import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS, PERMISSIONS } from '@briar/shared'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { todoDal } from '../dal/todoDal'
import { requirePermission } from '../middleware/permissionMiddleware'

const todoRoutes = new Hono()

const MAX_TITLE = 120

type AuthedUser = { id: string }

function currentUser(c: Context): AuthedUser | undefined {
	return (c.get('user') as AuthedUser | undefined) ?? undefined
}

function toPublic(record: NonNullable<Awaited<ReturnType<typeof todoDal.findById>>>) {
	return {
		id: record.id,
		title: record.title,
		done: Boolean(record.doneAt),
		doneAt: record.doneAt,
		sortOrder: record.sortOrder,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	}
}

/** GET / — 待办列表（仅管理员） */
todoRoutes.get('/', requirePermission(PERMISSIONS.PAGE_ADMIN), async (c) => {
	const items = await todoDal.listActive()
	return c.json<ApiResponse>({ success: true, data: { items: items.map(toPublic) } })
})

/** POST / — 新增待办 */
todoRoutes.post('/', requirePermission(PERMISSIONS.PAGE_ADMIN), async (c) => {
	const user = currentUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	const body = await c.req.json<{ title?: string }>().catch(() => ({}) as { title?: string })
	const title = typeof body.title === 'string' ? body.title.trim() : ''
	if (!title) {
		return c.json<ApiResponse>({ success: false, message: '标题不能为空' }, HTTP_STATUS.BAD_REQUEST)
	}
	if (title.length > MAX_TITLE) {
		return c.json<ApiResponse>(
			{ success: false, message: `标题过长（最多 ${MAX_TITLE} 字）` },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	const created = await todoDal.create({ userId: user.id, title })
	return c.json<ApiResponse>({ success: true, data: toPublic(created) }, HTTP_STATUS.CREATED)
})

/** PATCH /:id — 改标题或勾选 */
todoRoutes.patch('/:id', requirePermission(PERMISSIONS.PAGE_ADMIN), async (c) => {
	const id = c.req.param('id')
	const existing = await todoDal.findById(id)
	if (!existing) {
		return c.json<ApiResponse>({ success: false, message: '待办不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	const body = await c.req
		.json<{ title?: string; done?: boolean }>()
		.catch(() => ({}) as { title?: string; done?: boolean })

	let updated = existing
	if (typeof body.title === 'string') {
		const title = body.title.trim()
		if (!title) {
			return c.json<ApiResponse>(
				{ success: false, message: '标题不能为空' },
				HTTP_STATUS.BAD_REQUEST,
			)
		}
		if (title.length > MAX_TITLE) {
			return c.json<ApiResponse>(
				{ success: false, message: `标题过长（最多 ${MAX_TITLE} 字）` },
				HTTP_STATUS.BAD_REQUEST,
			)
		}
		const next = await todoDal.updateTitle(id, title)
		if (!next) {
			return c.json<ApiResponse>({ success: false, message: '更新失败' }, HTTP_STATUS.NOT_FOUND)
		}
		updated = next
	}
	if (typeof body.done === 'boolean') {
		const next = await todoDal.setDone(id, body.done)
		if (!next) {
			return c.json<ApiResponse>({ success: false, message: '更新失败' }, HTTP_STATUS.NOT_FOUND)
		}
		updated = next
	}
	return c.json<ApiResponse>({ success: true, data: toPublic(updated) })
})

/** DELETE /:id — 软删除 */
todoRoutes.delete('/:id', requirePermission(PERMISSIONS.PAGE_ADMIN), async (c) => {
	const id = c.req.param('id')
	const existing = await todoDal.findById(id)
	if (!existing) {
		return c.json<ApiResponse>({ success: false, message: '待办不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	await todoDal.softDelete(id)
	return c.json<ApiResponse>({ success: true })
})

export default todoRoutes
