import type { User } from '@briar/shared'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AUTH_CONFIG } from '../config/auth'
import { type UserRecord, userDal } from '../dal/userDal'
import { VerificationCodeType, verificationCodeDal } from '../dal/verificationCodeDal'
import { emailService } from './emailService'
import { permissionService } from './permissionService'

export interface AuthPayload {
	sub: string
	email: string
	name: string
}

const toPublicUser = (record: UserRecord): User => ({
	id: record.id,
	name: record.name,
	email: record.email,
	createdAt: record.createdAt,
})

/**
 * 生成随机 6 位验证码
 */
const generateVerificationCode = (): string => {
	return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 确保超级管理员账户拥有 admin 角色
 * 当指定邮箱的用户已存在时，自动分配 admin 角色
 */
const ADMIN_EMAIL = 'zhangleilaoge@qq.com'

const ensureAdminRole = async () => {
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

// 延迟执行，确保数据库连接已建立
setTimeout(() => {
	ensureAdminRole()
}, 1000)

export const authService = {
	async register(name: string, email: string, password: string) {
		const existing = await userDal.findByEmail(email)
		if (existing) {
			throw new Error('EMAIL_EXISTS')
		}

		const passwordHash = await bcrypt.hash(password, 10)
		const record = await userDal.create({ name, email, passwordHash })
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

		// 更新密码
		const passwordHash = await bcrypt.hash(newPassword, 10)
		const updatedUser = await userDal.update(user.id, { passwordHash })

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
		}

		return jwt.sign(payload, AUTH_CONFIG.jwtSecret, {
			expiresIn: AUTH_CONFIG.jwtExpiresIn,
		})
	},

	verifyToken(token: string) {
		return jwt.verify(token, AUTH_CONFIG.jwtSecret) as AuthPayload
	},

	async getUserById(id: string) {
		const record = await userDal.findById(id)
		return record ? toPublicUser(record) : null
	},
}
