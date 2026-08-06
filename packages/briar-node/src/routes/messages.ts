import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { messageDal } from '../dal/messageDal'

const messageRoutes = new Hono()

type AuthedUser = { id: string }

function requireUser(c: Context): AuthedUser | null {
	return (c.get('user') as AuthedUser | undefined) ?? null
}

function unauthorized(c: Context) {
	return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
}

/** GET / — 当前用户站内信列表（分页） */
messageRoutes.get('/', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize')) || 10))

	const { items, total } = await messageDal.listByUser(user.id, { page, pageSize })

	return c.json<ApiResponse>({
		success: true,
		data: { items, total, page, pageSize },
	})
})

/** GET /unread-count — 未读数 */
messageRoutes.get('/unread-count', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const count = await messageDal.countUnread(user.id)
	return c.json<ApiResponse>({ success: true, data: { count } })
})

/** POST /read-all — 全部标记已读 */
messageRoutes.post('/read-all', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const count = await messageDal.markAllRead(user.id)
	return c.json<ApiResponse>({ success: true, data: { count } })
})

/** POST /:id/read — 标记单条已读 */
messageRoutes.post('/:id/read', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	await messageDal.markRead(c.req.param('id'), user.id)
	return c.json<ApiResponse>({ success: true })
})

export default messageRoutes
