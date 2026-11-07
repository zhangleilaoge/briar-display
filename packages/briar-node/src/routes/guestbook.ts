import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { type Context, Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { guestbookDal } from '../dal/guestbookDal'
import { authService } from '../services/authService'
import { notifyAdminsNewGuestbook } from '../services/guestbookNotifyService'
import { permissionService } from '../services/permissionService'

const guestbookRoutes = new Hono()

const MAX_NICKNAME = 24
const MAX_CONTENT = 500
/** 每 IP 每 10 分钟最多 3 条（超管豁免） */
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 10 * 60_000

type AuthedUser = { id: string }

function requireUser(c: Context): AuthedUser | null {
	return (c.get('user') as AuthedUser | undefined) ?? null
}

async function resolveOptionalUser(c: Context): Promise<AuthedUser | null> {
	const existing = c.get('user') as AuthedUser | undefined
	if (existing) return existing
	const token =
		c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || getCookie(c, 'briar_token')
	if (!token) return null
	const auth = await authService.verifyLoginToken(token)
	return auth ? { id: auth.user.id } : null
}

function clientIp(c: Context): string {
	return (
		(c.req.header('x-forwarded-for') || '').split(',')[0].trim() ||
		c.req.header('x-real-ip') ||
		'unknown'
	)
}

function sanitizeText(raw: string): string {
	let out = ''
	for (const ch of raw) {
		const code = ch.charCodeAt(0)
		// 去掉 C0 控制符（保留 \t \n）
		if (code < 32 && code !== 9 && code !== 10) continue
		out += ch
	}
	return out.trim()
}

function toPublic(
	record: NonNullable<Awaited<ReturnType<typeof guestbookDal.findById>>>,
	opts?: { includeMeta?: boolean },
) {
	const base = {
		id: record.id,
		nickname: record.nickname,
		content: record.content,
		status: record.status,
		createdAt: record.createdAt,
	}
	if (!opts?.includeMeta) return base
	return {
		...base,
		reviewedAt: record.reviewedAt,
		ip: record.ip,
	}
}

/** GET / — 已通过留言（公开） */
guestbookRoutes.get('/', async (c) => {
	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize')) || 20))
	const { items, total } = await guestbookDal.list({ status: 'approved', page, pageSize })
	return c.json<ApiResponse>({
		success: true,
		data: {
			items: items.map((e) => toPublic(e)),
			total,
			page,
			pageSize,
		},
	})
})

/** GET /pending — 待审列表（仅管理员；公开 GET 前缀下自行解析可选登录态） */
guestbookRoutes.get('/pending', async (c) => {
	const user = (await resolveOptionalUser(c)) || requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	if (!(await permissionService.isAdmin(user.id))) {
		return c.json<ApiResponse>(
			{ success: false, message: '仅管理员可查看待审留言' },
			HTTP_STATUS.FORBIDDEN,
		)
	}
	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize')) || 20))
	const { items, total } = await guestbookDal.list({ status: 'pending', page, pageSize })
	return c.json<ApiResponse>({
		success: true,
		data: {
			items: items.map((e) => toPublic(e, { includeMeta: true })),
			total,
			page,
			pageSize,
		},
	})
})

/**
 * POST /submit — 访客提交留言（免登录；审核通过后公开展示）
 * 路径单独列入 API_UNRESTRICTED，避免放开 /guestbook/:id/* 写操作
 */
guestbookRoutes.post('/submit', async (c) => {
	const optional = await resolveOptionalUser(c)
	const body = await c.req
		.json<{ nickname?: string; content?: string }>()
		.catch(() => ({}) as { nickname?: string; content?: string })

	const nickname = sanitizeText(typeof body.nickname === 'string' ? body.nickname : '')
	const content = sanitizeText(typeof body.content === 'string' ? body.content : '')

	if (!nickname) {
		return c.json<ApiResponse>({ success: false, message: '请填写昵称' }, HTTP_STATUS.BAD_REQUEST)
	}
	if (nickname.length > MAX_NICKNAME) {
		return c.json<ApiResponse>(
			{ success: false, message: `昵称过长（最多 ${MAX_NICKNAME} 字）` },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	if (!content) {
		return c.json<ApiResponse>(
			{ success: false, message: '请填写留言内容' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	if (content.length > MAX_CONTENT) {
		return c.json<ApiResponse>(
			{ success: false, message: `内容过长（最多 ${MAX_CONTENT} 字）` },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const ip = clientIp(c)
	const isAdmin = optional ? await permissionService.isAdmin(optional.id) : false
	if (!isAdmin) {
		const recent = await guestbookDal.countRecentByIp(ip, RATE_WINDOW_MS)
		if (recent >= RATE_LIMIT) {
			return c.json<ApiResponse>(
				{ success: false, message: '留言太频繁，请稍后再试' },
				HTTP_STATUS.TOO_MANY_REQUESTS,
			)
		}
	}

	const uaRaw = c.req.header('user-agent') || ''
	const userAgent = uaRaw.slice(0, 255) || null
	const created = await guestbookDal.create({ nickname, content, ip, userAgent })

	notifyAdminsNewGuestbook({
		id: created.id,
		nickname: created.nickname,
		content: created.content,
	}).catch((e) => console.error('[guestbook-notify] 站内信失败:', e))

	return c.json<ApiResponse>(
		{
			success: true,
			data: { id: created.id },
			message: '已提交，通过审核后会展示在留言墙',
		},
		HTTP_STATUS.CREATED,
	)
})

/** POST /:id/approve — 通过审核 */
guestbookRoutes.post('/:id/approve', async (c) => {
	const user = requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	if (!(await permissionService.isAdmin(user.id))) {
		return c.json<ApiResponse>(
			{ success: false, message: '仅管理员可审核留言' },
			HTTP_STATUS.FORBIDDEN,
		)
	}
	const id = c.req.param('id')
	const updated = await guestbookDal.approve(id, user.id)
	if (!updated) {
		return c.json<ApiResponse>(
			{ success: false, message: '留言不存在或已处理' },
			HTTP_STATUS.NOT_FOUND,
		)
	}
	return c.json<ApiResponse>({ success: true, data: toPublic(updated) })
})

/** POST /:id/reject — 拒绝并软删除 */
guestbookRoutes.post('/:id/reject', async (c) => {
	const user = requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	if (!(await permissionService.isAdmin(user.id))) {
		return c.json<ApiResponse>(
			{ success: false, message: '仅管理员可审核留言' },
			HTTP_STATUS.FORBIDDEN,
		)
	}
	const id = c.req.param('id')
	const ok = await guestbookDal.reject(id, user.id)
	if (!ok) {
		return c.json<ApiResponse>(
			{ success: false, message: '留言不存在或已处理' },
			HTTP_STATUS.NOT_FOUND,
		)
	}
	return c.json<ApiResponse>({ success: true })
})

/** DELETE /:id — 软删除（已通过也可下架） */
guestbookRoutes.delete('/:id', async (c) => {
	const user = requireUser(c)
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}
	if (!(await permissionService.isAdmin(user.id))) {
		return c.json<ApiResponse>(
			{ success: false, message: '仅管理员可删除留言' },
			HTTP_STATUS.FORBIDDEN,
		)
	}
	const id = c.req.param('id')
	const existing = await guestbookDal.findById(id)
	if (!existing) {
		return c.json<ApiResponse>({ success: false, message: '留言不存在' }, HTTP_STATUS.NOT_FOUND)
	}
	await guestbookDal.softDelete(id)
	return c.json<ApiResponse>({ success: true })
})

export default guestbookRoutes
