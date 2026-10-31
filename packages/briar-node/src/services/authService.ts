import { randomBytes } from 'crypto'
import type { User } from '@briar/shared'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AUTH_CONFIG, isGoogleAuthConfigured } from '../config/auth'
import { type UserRecord, userDal } from '../dal/userDal'
import { userIdentityDal } from '../dal/userIdentityDal'
import { VerificationCodeType, verificationCodeDal } from '../dal/verificationCodeDal'
import { emailService } from './emailService'
import { verifyGoogleIdToken } from './googleIdToken'
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

export interface GoogleProfile {
	sub: string
	email: string
	emailVerified: boolean
	name: string
	picture?: string
}

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

/**
 * Google 登录落点决策（纯函数）：
 * 1. 该 Google sub 已绑定 → 登录绑定的用户
 * 2. 未绑定 + 邮箱已验证 + 同邮箱用户存在 → 自动关联到该用户
 * 3. 同邮箱用户存在但邮箱未验证 → 冲突（不能自动关联，也不能再建同邮箱账号）
 * 4. 否则新建用户
 */
export type GoogleLoginDecision =
	| { action: 'login'; userId: string }
	| { action: 'link'; userId: string }
	| { action: 'create' }
	| { action: 'conflict' }

export const decideGoogleLogin = (input: {
	identityUserId: string | null
	emailUserId: string | null
	emailVerified: boolean
}): GoogleLoginDecision => {
	if (input.identityUserId) return { action: 'login', userId: input.identityUserId }
	if (input.emailUserId) {
		return input.emailVerified
			? { action: 'link', userId: input.emailUserId }
			: { action: 'conflict' }
	}
	return { action: 'create' }
}

/** 解绑 Google 的前提：解绑后至少还剩一种登录方式（密码或其它第三方身份） */
export const canUnbindIdentity = (input: { hasPassword: boolean; otherIdentityCount: number }) =>
	input.hasPassword || input.otherIdentityCount > 0

const isDuplicateKeyError = (e: unknown) =>
	!!e && typeof e === 'object' && (e as { code?: string }).code === 'ER_DUP_ENTRY'

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
		if (record.disabledAt) throw new Error('ACCOUNT_DISABLED')

		const match = await bcrypt.compare(password, record.passwordHash)
		if (!match) {
			throw new Error('INVALID_PASSWORD')
		}

		const token = authService.createToken(record)
		const permissions = await permissionService.getUserPermissions(record.id)
		return { user: toPublicUser(record), token, permissions }
	},

	async sendPasswordResetCode(email: string) {
		// 不存在或已禁用都静默返回，避免枚举账号状态，也不发送重置邮件
		const user = await userDal.findByEmail(email)
		if (!user || user.disabledAt) {
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

		if (user.disabledAt) throw new Error('ACCOUNT_DISABLED')

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
		await userDal.update(user.id, { passwordHash, hasPassword: true })
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
	 * 校验登录 token（JWT 签名 + 用户存在且未禁用 + token_version 匹配）：
	 * 改密码或禁用账号后旧 token 立即失效；带 purpose 的专用 token（设备令牌/隐私解锁）不能当登录态用
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
		if (!user || user.disabledAt || (payload.tv ?? 0) !== user.tokenVersion) return null
		return { payload, user }
	},

	/** 滑动续期：剩余有效期不足一半时签发新 token（7 天 token 用过 3.5 天后随响应带回新 token） */
	maybeRefreshLoginToken(payload: AuthPayload, user: UserRecord): string | null {
		if (!payload.exp || !payload.iat) return null
		const nowSec = Math.floor(Date.now() / 1000)
		if (payload.exp - nowSec >= (payload.exp - payload.iat) / 2) return null
		return authService.createToken(user)
	},

	/** Google 登录（GIS ID Token）是否已配置 Client ID */
	isGoogleConfigured() {
		return isGoogleAuthConfigured()
	},

	/** GIS credential（ID Token）→ 本地验签 → Google 资料 */
	async verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
		const claims = await verifyGoogleIdToken(credential)
		const email = claims.email.toLowerCase()
		return {
			sub: claims.sub,
			email,
			emailVerified: true,
			name: (claims.name || email.split('@')[0] || 'Google User').slice(0, 100),
			picture: claims.picture,
		}
	},

	/**
	 * 用 Google 资料登录：先按 Google sub 找已绑定身份；未绑定且邮箱已验证则自动关联同邮箱用户；
	 * 否则新建用户（随机密码哈希，has_password=0）。关联到 zhangleilaoge@qq.com 时确保 admin 角色。
	 */
	async loginWithGoogle(profile: GoogleProfile) {
		const identity = await userIdentityDal.findByProviderUid('google', profile.sub)
		let record = identity ? await userDal.findById(identity.userId) : null
		const emailUser = record ? null : await userDal.findByEmail(profile.email)
		const decision = decideGoogleLogin({
			identityUserId: record?.id ?? null,
			emailUserId: emailUser?.id ?? null,
			emailVerified: profile.emailVerified,
		})

		if (
			(decision.action === 'login' && record?.disabledAt) ||
			(decision.action === 'link' && emailUser?.disabledAt)
		) {
			throw new Error('ACCOUNT_DISABLED')
		}
		if (decision.action === 'conflict') {
			throw new Error('GOOGLE_EMAIL_CONFLICT')
		}
		if (decision.action === 'link' && emailUser) {
			await userIdentityDal.create({
				userId: emailUser.id,
				provider: 'google',
				providerUid: profile.sub,
				email: profile.email,
			})
			record = emailUser
		} else if (decision.action === 'create') {
			const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10)
			record = await userDal.create({
				name: profile.name,
				email: profile.email,
				passwordHash,
				hasPassword: false,
				avatar: profile.picture ?? null,
			})
			await userIdentityDal.create({
				userId: record.id,
				provider: 'google',
				providerUid: profile.sub,
				email: profile.email,
			})
		}
		if (!record) throw new Error('USER_NOT_FOUND')

		if (!record.avatar && profile.picture) {
			record = (await userDal.update(record.id, { avatar: profile.picture })) || record
		}

		// 超级管理员邮箱：与启动时 ensureAdminRole 一致，首次 Google 登录也要落到 admin
		if (record.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
			await ensureAdminRole()
		}

		const token = authService.createToken(record)
		const permissions = await permissionService.getUserPermissions(record.id)
		return { user: toPublicUser(record), token, permissions }
	},

	/** 当前用户的登录方式：是否有密码 + 已绑定的第三方身份 */
	async listLoginMethods(userId: string) {
		const record = await userDal.findById(userId)
		if (!record) throw new Error('USER_NOT_FOUND')
		const identities = await userIdentityDal.listByUser(userId)
		return {
			hasPassword: record.hasPassword,
			identities: identities.map((i) => ({
				provider: i.provider,
				email: i.email,
				createdAt: i.createdAt,
			})),
		}
	},

	/** 给已登录用户绑定 Google 身份；该 Google 账号已属于其他用户则报 GOOGLE_IDENTITY_TAKEN */
	async bindGoogle(userId: string, profile: GoogleProfile) {
		const existing = await userIdentityDal.findByProviderUid('google', profile.sub)
		if (existing) {
			if (existing.userId !== userId) throw new Error('GOOGLE_IDENTITY_TAKEN')
			return authService.listLoginMethods(userId)
		}
		const mine = await userIdentityDal.listByUser(userId)
		if (mine.some((i) => i.provider === 'google')) throw new Error('GOOGLE_ALREADY_BOUND')
		try {
			await userIdentityDal.create({
				userId,
				provider: 'google',
				providerUid: profile.sub,
				email: profile.email,
			})
		} catch (e) {
			if (isDuplicateKeyError(e)) throw new Error('GOOGLE_IDENTITY_TAKEN')
			throw e
		}
		return authService.listLoginMethods(userId)
	},

	/** 解绑 Google：必须还剩其它登录方式（密码或其它身份），否则 LAST_LOGIN_METHOD */
	async unbindGoogle(userId: string) {
		const record = await userDal.findById(userId)
		if (!record) throw new Error('USER_NOT_FOUND')
		const identities = await userIdentityDal.listByUser(userId)
		if (!identities.some((i) => i.provider === 'google')) throw new Error('GOOGLE_NOT_BOUND')
		const otherIdentityCount = identities.filter((i) => i.provider !== 'google').length
		if (!canUnbindIdentity({ hasPassword: record.hasPassword, otherIdentityCount })) {
			throw new Error('LAST_LOGIN_METHOD')
		}
		await userIdentityDal.deleteByUserProvider(userId, 'google')
		return authService.listLoginMethods(userId)
	},

	async getUserById(id: string) {
		const record = await userDal.findById(id)
		return record ? toPublicUser(record) : null
	},
}
