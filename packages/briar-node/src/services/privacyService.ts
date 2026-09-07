import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AUTH_CONFIG } from '../config/auth'
import { folderDal } from '../dal/folderDal'
import { userDal } from '../dal/userDal'
import { VerificationCodeType, verificationCodeDal } from '../dal/verificationCodeDal'
import { EmailTemplate, emailService } from './emailService'

export const PRIVACY_TOKEN_PURPOSE = 'files-privacy'
const UNLOCK_TOKEN_EXPIRES_IN = '12h'
const UNLOCK_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const CODE_EXPIRES_MS = 15 * 60 * 1000 // 验证码 15 分钟有效
const MIN_PASSWORD_LENGTH = 6
const UNLOCK_RATE_LIMIT = 5 // 每用户每分钟最多 5 次失败尝试（防爆破）
const UNLOCK_RATE_WINDOW_MS = 60 * 1000

export interface UnlockTokenPayload {
	sub: string
	purpose: typeof PRIVACY_TOKEN_PURPOSE
}

/** unlock 失败尝试记录（内存限频，userId -> 失败时间戳） */
const unlockFailures = new Map<string, number[]>()

function checkUnlockRateLimit(userId: string) {
	const now = Date.now()
	const attempts = (unlockFailures.get(userId) ?? []).filter((t) => now - t < UNLOCK_RATE_WINDOW_MS)
	unlockFailures.set(userId, attempts)
	if (attempts.length >= UNLOCK_RATE_LIMIT) throw new Error('RATE_LIMITED')
}

function recordUnlockFailure(userId: string) {
	unlockFailures.get(userId)?.push(Date.now())
}

function clearUnlockFailures(userId: string) {
	unlockFailures.delete(userId)
}

/** 安全密码强度：≥6 位，且不得与登录密码相同 */
async function assertPasswordValid(record: { passwordHash: string }, password: string) {
	if (password.length < MIN_PASSWORD_LENGTH) throw new Error('PASSWORD_TOO_SHORT')
	if (await bcrypt.compare(password, record.passwordHash)) throw new Error('SAME_AS_LOGIN')
}

export const privacyService = {
	async getStatus(userId: string) {
		const record = await userDal.findById(userId)
		if (!record) throw new Error('USER_NOT_FOUND')
		return { hasSecurityPassword: !!record.securityPasswordHash }
	},

	/** 签发 12h 有效的隐私空间解锁令牌 */
	issueUnlockToken(userId: string) {
		const token = jwt.sign(
			{ sub: userId, purpose: PRIVACY_TOKEN_PURPOSE } satisfies UnlockTokenPayload,
			AUTH_CONFIG.jwtSecret,
			{ expiresIn: UNLOCK_TOKEN_EXPIRES_IN },
		)
		return { token, expiresAt: new Date(Date.now() + UNLOCK_TOKEN_TTL_MS) }
	},

	/** 首次设置安全密码（已设置则拒绝，走 change/reset）；设置成功即视为已解锁，直接发 token */
	async setupPassword(userId: string, password: string) {
		const record = await userDal.findById(userId)
		if (!record) throw new Error('USER_NOT_FOUND')
		if (record.securityPasswordHash) throw new Error('ALREADY_SET')
		await assertPasswordValid(record, password)
		await userDal.update(userId, { securityPasswordHash: await bcrypt.hash(password, 10) })
		return privacyService.issueUnlockToken(userId)
	},

	async changePassword(userId: string, oldPassword: string, newPassword: string) {
		const record = await userDal.findById(userId)
		if (!record) throw new Error('USER_NOT_FOUND')
		if (!record.securityPasswordHash) throw new Error('NOT_SET')
		if (!(await bcrypt.compare(oldPassword, record.securityPasswordHash))) {
			throw new Error('INVALID_PASSWORD')
		}
		await assertPasswordValid(record, newPassword)
		await userDal.update(userId, { securityPasswordHash: await bcrypt.hash(newPassword, 10) })
	},

	/** 发送隐私空间验证码（解锁二选一 / 忘记安全密码的重置通道） */
	async sendCode(userId: string) {
		const record = await userDal.findById(userId)
		if (!record) throw new Error('USER_NOT_FOUND')

		const code = Math.floor(100000 + Math.random() * 900000).toString()
		const expiresAt = new Date(Date.now() + CODE_EXPIRES_MS)

		await verificationCodeDal.deleteByTargetAndType(
			record.email,
			VerificationCodeType.FILES_PRIVACY,
		)
		await verificationCodeDal.create(
			record.email,
			VerificationCodeType.FILES_PRIVACY,
			code,
			expiresAt,
		)

		try {
			await emailService.sendEmail(record.email, {
				TemplateID: EmailTemplate.GENERIC_VERIFICATION,
				TemplateData: { name: record.name, verificationCode: code },
				subject: 'xiaobuzi - 隐私空间验证码',
			})
		} catch (error) {
			console.error('Failed to send privacy code:', error)
			throw new Error('SEND_EMAIL_FAILED')
		}
	},

	/** 邮箱验证码重置安全密码（忘记密码通道） */
	async resetPassword(userId: string, code: string, newPassword: string) {
		const record = await userDal.findById(userId)
		if (!record) throw new Error('USER_NOT_FOUND')

		const codeRecord = await verificationCodeDal.findValidByTargetTypeAndCode(
			record.email,
			VerificationCodeType.FILES_PRIVACY,
			code,
		)
		if (!codeRecord) throw new Error('INVALID_CODE')
		await verificationCodeDal.markAsUsed(codeRecord.id)

		await assertPasswordValid(record, newPassword)
		await userDal.update(userId, { securityPasswordHash: await bcrypt.hash(newPassword, 10) })
	},

	/** 解锁：安全密码 / 邮箱验证码二选一，通过则签 12h token；失败计入内存限频 */
	async unlock(userId: string, params: { password?: string; code?: string }) {
		checkUnlockRateLimit(userId)
		const record = await userDal.findById(userId)
		if (!record) throw new Error('USER_NOT_FOUND')

		if (params.password) {
			if (!record.securityPasswordHash) throw new Error('NOT_SET')
			if (!(await bcrypt.compare(params.password, record.securityPasswordHash))) {
				recordUnlockFailure(userId)
				throw new Error('INVALID_PASSWORD')
			}
		} else if (params.code) {
			const codeRecord = await verificationCodeDal.findValidByTargetTypeAndCode(
				record.email,
				VerificationCodeType.FILES_PRIVACY,
				params.code,
			)
			if (!codeRecord) {
				recordUnlockFailure(userId)
				throw new Error('INVALID_CODE')
			}
			await verificationCodeDal.markAsUsed(codeRecord.id)
		} else {
			throw new Error('INVALID_CREDENTIALS')
		}

		clearUnlockFailures(userId)
		return privacyService.issueUnlockToken(userId)
	},

	/** 校验解锁令牌是否有效且属于指定用户 */
	verifyUnlockToken(token: string, userId: string): boolean {
		try {
			const payload = jwt.verify(token, AUTH_CONFIG.jwtSecret) as UnlockTokenPayload
			return payload.purpose === PRIVACY_TOKEN_PURPOSE && payload.sub === userId
		} catch {
			return false
		}
	},

	/** 隐私链路判断：文件夹自身或任一祖先 is_private=1 */
	async isPrivateChain(userId: string, folderId: string): Promise<boolean> {
		const folders = await folderDal.listByUser(userId)
		const byId = new Map(folders.map((f) => [f.id, f]))
		let current = byId.get(folderId)
		while (current) {
			if (current.isPrivate) return true
			current = current.parentId ? byId.get(current.parentId) : undefined
		}
		return false
	},

	/** 用户全部隐私链路文件夹 id（隐私文件夹自身 + 全部子孙），用于列表/搜索排除 */
	async privateScopeFolderIds(userId: string): Promise<string[]> {
		const folders = await folderDal.listByUser(userId)
		const childrenMap = new Map<string | null, string[]>()
		for (const f of folders) {
			const list = childrenMap.get(f.parentId) || []
			list.push(f.id)
			childrenMap.set(f.parentId, list)
		}
		const scope = new Set<string>()
		const queue = folders.filter((f) => f.isPrivate).map((f) => f.id)
		while (queue.length > 0) {
			const current = queue.shift()!
			if (scope.has(current)) continue
			scope.add(current)
			queue.push(...(childrenMap.get(current) || []))
		}
		return [...scope]
	},

	/** 设为隐私的前置校验，返回错误信息或 null（调用方需先校验解锁令牌） */
	async validateSetPrivate(userId: string, folderId: string): Promise<string | null> {
		const folder = await folderDal.findById(folderId)
		if (!folder || folder.userId !== userId) return '文件夹不存在'
		if (folder.isPrivate) return '该文件夹已是隐私文件夹'
		if (folder.parentId && (await privacyService.isPrivateChain(userId, folder.parentId))) {
			return '父级已在隐私空间内，不支持嵌套设置'
		}
		const descendantIds = await folderDal.collectDescendantIds(userId, folderId)
		const folders = await folderDal.listByUser(userId)
		const descendants = folders.filter((f) => descendantIds.includes(f.id) && f.id !== folderId)
		if (descendants.some((f) => f.isPrivate)) {
			return '子文件夹中已存在隐私文件夹，请先取消子级隐私'
		}
		return null
	},
}
