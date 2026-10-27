import { randomBytes } from 'crypto'
import type { User } from '@briar/shared'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AUTH_CONFIG, isGoogleAuthConfigured } from '../config/auth'
import { type UserRecord, userDal } from '../dal/userDal'
import { VerificationCodeType, verificationCodeDal } from '../dal/verificationCodeDal'
import { fetchViaProxy } from '../lib/outboundProxy'
import { emailService } from './emailService'
import { permissionService } from './permissionService'

export interface AuthPayload {
	sub: string
	email: string
	name: string
	/** 令牌版本：与 users.token_version 一致才有效（改密码即吊销旧 token） */
	tv?: number
	iat?: number
	exp?: number
}

/** Google OAuth state（短时 JWT，防 CSRF；r = 登录成功回跳路径） */
interface GoogleOAuthState {
	purpose: 'google_oauth'
	r: string
	n: string
}

export interface GoogleProfile {
	sub: string
	email: string
	emailVerified: boolean
	name: string
	picture?: string
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const GOOGLE_FETCH_TIMEOUT_MS = 15_000

/** 国内服务器直连 Google 不通：BRIAR_GOOGLE_PROXY 优先，其次复用 BRIAR_MEDIA_OUTBOUND_PROXY */
const googleProxyUri = () =>
	process.env.BRIAR_GOOGLE_PROXY?.trim() || process.env.BRIAR_MEDIA_OUTBOUND_PROXY?.trim() || ''

const fetchGoogle = (url: string, init: RequestInit) =>
	fetchViaProxy(googleProxyUri(), url, {
		...init,
		signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
	})

/** 仅允许站内相对路径回跳，防止开放重定向 */
export const sanitizeLoginRedirect = (
	redirect: string | undefined | null,
	fallback = '/briar/',
) => {
	if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
		return redirect
	}
	return fallback
}

const toPublicUser = (record: UserRecord): User => ({
	id: record.id,
	name: record.name,
	email: record.email,
	avatar: record.avatar ?? undefined,
	createdAt: record.createdAt,
})

/**
 * 生成随机 6 位验证码
 */
const generateVerificationCode = (): string => {
	return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 确保超级管理员账户拥有 admin 角色（服务启动时由 index.ts 调用，勿在模块加载期执行——
 * 模块级副作用会让 import 它的单测碰数据库）
 */
const ADMIN_EMAIL = 'zhangleilaoge@qq.com'

export const ensureAdminRole = async () => {
	try {
		const adminUser = await userDal.findByEmail(ADMIN_EMAIL)
		if (!adminUser) {
			console.log(`ℹ️  管理员账户 ${ADMIN_EMAIL} 尚未注册，跳过角色分配`)
			return
		}

		const { userRoleDal } = await import('../dal/userRoleDal')
		const { roleDal } = await import('../dal/roleDal')

		const adminRole = await roleDal.findByName('admin')
		if (!adminRole) {
			console.error('❌ admin 角色不存在，请先执行数据库初始化')
			return
		}

		const hasRole = await userRoleDal.hasRole(adminUser.id, adminRole.id)
		if (!hasRole) {
			await userRoleDal.addRole(adminUser.id, adminRole.id)
			console.log(`✅ 已为 ${ADMIN_EMAIL} 分配 admin 角色`)
		}
	} catch (error) {
		console.error('❌ 管理员角色分配失败:', error)
	}
}

export const authService = {
	async register(name: string, email: string, password: string) {
		const existing = await userDal.findByEmail(email)
		if (existing) {
			throw new Error('EMAIL_EXISTS')
		}

		const passwordHash = await bcrypt.hash(password, 10)
		const record = await userDal.create({ name, email, passwordHash, avatar: null })
		const token = authService.createToken(record)
		const permissions = await permissionService.getUserPermissions(record.id)
		return { user: toPublicUser(record), token, permissions }
	},

	async login(email: string, password: string) {
		const record = await userDal.findByEmail(email)
		if (!record) {
			throw new Error('USER_NOT_FOUND')
		}

		const match = await bcrypt.compare(password, record.passwordHash)
		if (!match) {
			throw new Error('INVALID_PASSWORD')
		}

		const token = authService.createToken(record)
		const permissions = await permissionService.getUserPermissions(record.id)
		return { user: toPublicUser(record), token, permissions }
	},

	async sendPasswordResetCode(email: string) {
		// 验证用户是否存在，不存在则静默返回（防止枚举攻击）
		const user = await userDal.findByEmail(email)
		if (!user) {
			return
		}

		// 生成验证码
		const code = generateVerificationCode()

		// 设置验证码过期时间为 15 分钟
		const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

		// 删除该邮箱之前的重置密码验证码
		await verificationCodeDal.deleteByTargetAndType(email, VerificationCodeType.RESET_PASSWORD)

		// 保存新的验证码
		await verificationCodeDal.create(email, VerificationCodeType.RESET_PASSWORD, code, expiresAt)

		// 发送邮件
		try {
			await emailService.sendPasswordResetCode(email, user.name, code)
		} catch (error) {
			console.error('Failed to send password reset code:', error)
			throw new Error('SEND_EMAIL_FAILED')
		}
	},

	async resetPassword(email: string, code: string, newPassword: string) {
		// 验证用户是否存在
		const user = await userDal.findByEmail(email)
		if (!user) {
			throw new Error('USER_NOT_FOUND')
		}

		// 验证验证码
		const resetCode = await verificationCodeDal.findValidByTargetTypeAndCode(
			email,
			VerificationCodeType.RESET_PASSWORD,
			code,
		)
		if (!resetCode) {
			throw new Error('INVALID_CODE')
		}

		// 标记该验证码为已使用
		await verificationCodeDal.markAsUsed(resetCode.id)

		// 更新密码并吊销既有 token（token_version 自增，旧 token 立即失效）
		const passwordHash = await bcrypt.hash(newPassword, 10)
		await userDal.update(user.id, { passwordHash })
		const updatedUser = await userDal.incrementTokenVersion(user.id)

		if (!updatedUser) {
			throw new Error('UPDATE_FAILED')
		}

		const token = authService.createToken(updatedUser)
		const permissions = await permissionService.getUserPermissions(updatedUser.id)
		return { user: toPublicUser(updatedUser), token, permissions }
	},

	createToken(record: UserRecord) {
		const payload: AuthPayload = {
			sub: record.id,
			email: record.email,
			name: record.name,
			tv: record.tokenVersion ?? 0,
		}

		return jwt.sign(payload, AUTH_CONFIG.jwtSecret, {
			expiresIn: AUTH_CONFIG.jwtExpiresIn,
		})
	},

	verifyToken(token: string) {
		return jwt.verify(token, AUTH_CONFIG.jwtSecret) as AuthPayload
	},

	/**
	 * 校验登录 token（JWT 签名 + 用户存在 + token_version 匹配）：
	 * 改密码后旧 token 立即失效；带 purpose 的专用 token（设备令牌/隐私解锁）不能当登录态用
	 */
	async verifyLoginToken(
		token: string,
	): Promise<{ payload: AuthPayload; user: UserRecord } | null> {
		let payload: AuthPayload & { purpose?: string }
		try {
			payload = jwt.verify(token, AUTH_CONFIG.jwtSecret) as AuthPayload & { purpose?: string }
		} catch {
			return null
		}
		if (payload.purpose) return null
		const user = await userDal.findById(payload.sub)
		if (!user || (payload.tv ?? 0) !== user.tokenVersion) return null
		return { payload, user }
	},

	/** 滑动续期：剩余有效期不足一半时签发新 token（7 天 token 用过 3.5 天后随响应带回新 token） */
	maybeRefreshLoginToken(payload: AuthPayload, user: UserRecord): string | null {
		if (!payload.exp || !payload.iat) return null
		const nowSec = Math.floor(Date.now() / 1000)
		if (payload.exp - nowSec >= (payload.exp - payload.iat) / 2) return null
		return authService.createToken(user)
	},

	/** Google OAuth 是否已配置 Client ID/Secret */
	isGoogleConfigured() {
		return isGoogleAuthConfigured()
	},

	/** 签发 OAuth state（10 分钟有效） */
	createGoogleOAuthState(redirect: string) {
		const payload: GoogleOAuthState = {
			purpose: 'google_oauth',
			r: sanitizeLoginRedirect(redirect),
			n: randomBytes(16).toString('hex'),
		}
		return jwt.sign(payload, AUTH_CONFIG.jwtSecret, { expiresIn: '10m' })
	},

	verifyGoogleOAuthState(state: string): GoogleOAuthState {
		const payload = jwt.verify(state, AUTH_CONFIG.jwtSecret) as GoogleOAuthState & {
			purpose?: string
		}
		if (payload.purpose !== 'google_oauth' || typeof payload.r !== 'string') {
			throw new Error('INVALID_STATE')
		}
		return payload
	},

	/** 构造 Google 授权页 URL */
	buildGoogleAuthorizeUrl(state: string) {
		if (!isGoogleAuthConfigured()) {
			throw new Error('GOOGLE_NOT_CONFIGURED')
		}
		const params = new URLSearchParams({
			client_id: AUTH_CONFIG.googleClientId,
			redirect_uri: AUTH_CONFIG.googleRedirectUri,
			response_type: 'code',
			scope: 'openid email profile',
			state,
			access_type: 'online',
			prompt: 'select_account',
		})
		return `${GOOGLE_AUTH_URL}?${params.toString()}`
	},

	/** code → Google 用户资料 */
	async fetchGoogleProfile(code: string): Promise<GoogleProfile> {
		if (!isGoogleAuthConfigured()) {
			throw new Error('GOOGLE_NOT_CONFIGURED')
		}

		const body = new URLSearchParams({
			code,
			client_id: AUTH_CONFIG.googleClientId,
			client_secret: AUTH_CONFIG.googleClientSecret,
			redirect_uri: AUTH_CONFIG.googleRedirectUri,
			grant_type: 'authorization_code',
		})

		const tokenRes = await fetchGoogle(GOOGLE_TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		})
		if (!tokenRes.ok) {
			const detail = await tokenRes.text().catch(() => '')
			console.error('Google token exchange failed:', tokenRes.status, detail.slice(0, 500))
			throw new Error('GOOGLE_TOKEN_FAILED')
		}
		const tokenJson = (await tokenRes.json()) as { access_token?: string }
		if (!tokenJson.access_token) {
			throw new Error('GOOGLE_TOKEN_FAILED')
		}

		const infoRes = await fetchGoogle(GOOGLE_USERINFO_URL, {
			headers: { Authorization: `Bearer ${tokenJson.access_token}` },
		})
		if (!infoRes.ok) {
			console.error('Google userinfo failed:', infoRes.status)
			throw new Error('GOOGLE_USERINFO_FAILED')
		}
		const info = (await infoRes.json()) as {
			sub?: string
			email?: string
			email_verified?: boolean | string
			name?: string
			picture?: string
		}
		if (!info.sub || !info.email) {
			throw new Error('GOOGLE_PROFILE_INCOMPLETE')
		}
		const emailVerified = info.email_verified === true || info.email_verified === 'true'
		if (!emailVerified) {
			throw new Error('GOOGLE_EMAIL_UNVERIFIED')
		}

		return {
			sub: info.sub,
			email: info.email.toLowerCase(),
			emailVerified,
			name: (info.name || info.email.split('@')[0] || 'Google User').slice(0, 100),
			picture: info.picture,
		}
	},

	/**
	 * 用 Google 资料登录：优先 google_sub，其次邮箱关联已有账号；新用户随机密码哈希（仅 OAuth）。
	 * 关联到 zhangleilaoge@qq.com 时确保 admin 角色。
	 */
	async loginWithGoogle(profile: GoogleProfile) {
		let record = await userDal.findByGoogleSub(profile.sub)
		if (!record) {
			record = await userDal.findByEmail(profile.email)
			if (record) {
				// 邮箱已存在 → 绑定 google_sub；头像空时补 Google 头像
				const patch: Partial<UserRecord> = { googleSub: profile.sub }
				if (!record.avatar && profile.picture) {
					patch.avatar = profile.picture
				}
				record = (await userDal.update(record.id, patch)) || record
			} else {
				const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10)
				record = await userDal.create({
					name: profile.name,
					email: profile.email,
					passwordHash,
					avatar: profile.picture ?? null,
					googleSub: profile.sub,
				})
			}
		} else if (!record.avatar && profile.picture) {
			record = (await userDal.update(record.id, { avatar: profile.picture })) || record
		}

		// 超级管理员邮箱：与启动时 ensureAdminRole 一致，首次 Google 登录也要落到 admin
		if (profile.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
			await ensureAdminRole()
		}

		const token = authService.createToken(record)
		const permissions = await permissionService.getUserPermissions(record.id)
		return { user: toPublicUser(record), token, permissions }
	},

	async getUserById(id: string) {
		const record = await userDal.findById(id)
		return record ? toPublicUser(record) : null
	},
}
