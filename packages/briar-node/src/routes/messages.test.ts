import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { Hono } from 'hono'

// 内存版 messageDal：只替换本测试用到的方法，不碰数据库
type Msg = { id: string; userId: string; readAt: Date | null }
let store: Msg[] = []

mock.module('../dal/messageDal', () => ({
	messageDal: {
		async deleteOne(id: string, userId: string) {
			const before = store.length
			store = store.filter((m) => !(m.id === id && m.userId === userId))
			return store.length < before
		},
		async deleteRead(userId: string) {
			const before = store.length
			store = store.filter((m) => !(m.userId === userId && m.readAt !== null))
			return before - store.length
		},
		async countUnread(userId: string) {
			return store.filter((m) => m.userId === userId && m.readAt === null).length
		},
	},
}))

const { default: messageRoutes } = await import('./messages')

function appAs(userId: string | null) {
	const app = new Hono()
	app.use('*', async (c, next) => {
		if (userId) c.set('user' as never, { id: userId } as never)
		await next()
	})
	app.route('/messages', messageRoutes)
	return app
}

type Body = { success: boolean; data?: { count: number } }
const json = async (res: Response) => (await res.json()) as Body

beforeEach(() => {
	store = [
		{ id: 'a', userId: 'u1', readAt: new Date() },
		{ id: 'b', userId: 'u1', readAt: null },
		{ id: 'c', userId: 'u1', readAt: new Date() },
		{ id: 'd', userId: 'u2', readAt: new Date() },
	]
})

describe('站内信删除', () => {
	test('未登录 401', async () => {
		const res = await appAs(null).request('/messages/a', { method: 'DELETE' })
		expect(res.status).toBe(401)
	})

	test('删除本人消息成功', async () => {
		const res = await appAs('u1').request('/messages/a', { method: 'DELETE' })
		expect(res.status).toBe(200)
		expect(store.map((m) => m.id)).toEqual(['b', 'c', 'd'])
	})

	test('不能删除他人消息（404，数据不变）', async () => {
		const res = await appAs('u1').request('/messages/d', { method: 'DELETE' })
		expect(res.status).toBe(404)
		expect(store).toHaveLength(4)
	})

	test('清空已读只删本人已读，未读数不变', async () => {
		const app = appAs('u1')
		const unreadBefore = (await json(await app.request('/messages/unread-count'))).data?.count
		const res = await app.request('/messages?scope=read', { method: 'DELETE' })
		const body = await json(res)
		expect(res.status).toBe(200)
		expect(body.data?.count).toBe(2)
		expect(store.map((m) => m.id)).toEqual(['b', 'd'])
		const unreadAfter = (await json(await app.request('/messages/unread-count'))).data?.count
		expect(unreadAfter).toBe(unreadBefore)
	})

	test('缺少 scope=read 时 400，不删除任何消息', async () => {
		const res = await appAs('u1').request('/messages', { method: 'DELETE' })
		expect(res.status).toBe(400)
		expect(store).toHaveLength(4)
	})
})
