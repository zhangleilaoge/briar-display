import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { Hono } from 'hono'

interface TestThought {
	id: string
	userId: string
	body: string
	isPrivate: boolean
	createdAt: Date
	updatedAt: Date
	authorName: string
	authorAvatar: null
	likeCount: number
	likedByMe: boolean
	tags: string[]
}

function makeThought(id: string, userId: string, isPrivate: boolean): TestThought {
	return {
		id,
		userId,
		body: id,
		isPrivate,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		updatedAt: new Date('2026-01-01T00:00:00Z'),
		authorName: userId,
		authorAvatar: null,
		likeCount: 0,
		likedByMe: false,
		tags: [isPrivate ? '私密标签' : '公开标签'],
	}
}

let items: TestThought[]
let createInput: { userId: string; body: string; isPrivate: boolean } | null
let updateInput: { id: string; body: string; isPrivate: boolean } | null
let likeCalls: number

function visibleTo(viewerId?: string | null) {
	return items.filter((item) => !item.isPrivate || item.userId === viewerId)
}

mock.module('../dal/thoughtDal', () => ({
	thoughtDal: {
		async list({ viewerId }: { viewerId?: string | null }) {
			const visible = visibleTo(viewerId)
			return { items: visible, total: visible.length }
		},
		async listTags(_limit: number, viewerId?: string | null) {
			const counts = new Map<string, number>()
			for (const item of visibleTo(viewerId)) {
				for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
			}
			return [...counts].map(([tag, count]) => ({ tag, count }))
		},
		async create(data: { userId: string; body: string; isPrivate: boolean }) {
			createInput = data
			return { ...makeThought('created', data.userId, data.isPrivate), body: data.body }
		},
		async findById(id: string, viewerId?: string | null) {
			return visibleTo(viewerId).find((item) => item.id === id) ?? null
		},
		async updateBody(id: string, _userId: string, body: string, isPrivate: boolean) {
			updateInput = { id, body, isPrivate }
			const item = items.find((thought) => thought.id === id)
			return item ? { ...item, body, isPrivate } : null
		},
		async like() {
			likeCalls++
			return { likeCount: 1, liked: true }
		},
	},
}))

mock.module('../services/permissionService', () => ({
	permissionService: {
		async isAdmin() {
			return true
		},
	},
}))

const { default: thoughtRoutes } = await import('./thoughts')

function appAs(userId: string | null) {
	const app = new Hono()
	app.use('*', async (c, next) => {
		if (userId) c.set('user' as never, { id: userId } as never)
		await next()
	})
	app.route('/thoughts', thoughtRoutes)
	return app
}

beforeEach(() => {
	items = [makeThought('public', 'u1', false), makeThought('secret', 'u1', true)]
	createInput = null
	updateInput = null
	likeCalls = 0
})

interface ThoughtListBody {
	data: { total: number; items: TestThought[] }
}

interface TagListBody {
	data: { tag: string; count: number }[]
}

describe('想法可见范围路由契约', () => {
	test('作者能看到私密想法，其他用户和访客只能看到公开想法', async () => {
		for (const [userId, expected] of [
			['u1', 2],
			['u2', 1],
			[null, 1],
		] as const) {
			const response = await appAs(userId).request('/thoughts')
			const body = (await response.json()) as ThoughtListBody
			expect(body.data.total).toBe(expected)
			expect(body.data.items.some((item: TestThought) => item.id === 'secret')).toBe(
				userId === 'u1',
			)
		}
	})

	test('标签计数只统计当前用户可见的想法', async () => {
		const ownerBody = (await (await appAs('u1').request('/thoughts/tags')).json()) as TagListBody
		const otherBody = (await (await appAs('u2').request('/thoughts/tags')).json()) as TagListBody
		expect(ownerBody.data).toContainEqual({ tag: '私密标签', count: 1 })
		expect(otherBody.data).not.toContainEqual({ tag: '私密标签', count: 1 })
	})

	test('发布时传递私密标记', async () => {
		const response = await appAs('u1').request('/thoughts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ body: '一条私密想法', isPrivate: true }),
		})
		expect(response.status).toBe(201)
		expect(createInput).toEqual({ userId: 'u1', body: '一条私密想法', isPrivate: true })
	})

	test('旧编辑请求保留私密状态，也可显式切换为公开', async () => {
		await appAs('u1').request('/thoughts/secret', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ body: '仅修改正文' }),
		})
		expect(updateInput).toEqual({ id: 'secret', body: '仅修改正文', isPrivate: true })
		await appAs('u1').request('/thoughts/secret', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ body: '转为公开', isPrivate: false }),
		})
		expect(updateInput).toEqual({ id: 'secret', body: '转为公开', isPrivate: false })
	})

	test('其他用户不能对私密想法点赞', async () => {
		const response = await appAs('u2').request('/thoughts/secret/like', { method: 'POST' })
		expect(response.status).toBe(404)
		expect(likeCalls).toBe(0)
	})
})
