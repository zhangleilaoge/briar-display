import type { User } from '@briar/shared'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AUTH_CONFIG } from '../config/auth'
import { type UserRecord, userDal } from '../dal/userDal'
import { VerificationCodeType, verificationCodeDal } from '../dal/verificationCodeDal'
import { emailService } from './emailService'

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
 * 创建默认管理员账户
 */
const seedDefaultUser = async () => {
	try {
		const existing = await userDal.findByEmail('admin@briar.dev')
		if (existing) {
			return
		}

		const passwordHash = await bcrypt.hash('admin123', 10)
		await userDal.create({
			name: 'Briar Admin',
			email: 'admin@briar.dev',
			passwordHash,
		})
		console.log('✅ 默认管理员账户已创建')
	} catch (error) {
		console.error('❌ 创建默认管理员账户失败:', error)
	}
}

// 延迟执行，确保数据库连接已建立
setTimeout(() => {
	seedDefaultUser()
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
		return { user: toPublicUser(record), token }
	},

	async login(email: string, password: string) {
		const record = await userDal.findByEmail(email)
		if (!record) {
			throw new Error('INVALID_CREDENTIALS')
		}

		const match = await bcrypt.compare(password, record.passwordHash)
		if (!match) {
			throw new Error('INVALID_CREDENTIALS')
		}

		const token = authService.createToken(record)
		return { user: toPublicUser(record), token }
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
		return { user: toPublicUser(updatedUser), token }
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
