import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

/**
 * 验证码类型枚举
 */
export enum VerificationCodeType {
	/**
	 * 密码重置验证码
	 */
	RESET_PASSWORD = 'reset_password',
	/**
	 * 邮箱验证码
	 */
	EMAIL_VERIFICATION = 'email_verification',
	/**
	 * 绑定邮箱验证码
	 */
	BIND_EMAIL = 'bind_email',
	/**
	 * 账户恢复验证码
	 */
	ACCOUNT_RECOVERY = 'account_recovery',
	/**
	 * SSH 控制台设备授权验证码
	 */
	TERMINAL_ACCESS = 'terminal_access',
}

export interface VerificationCodeRecord {
	id: string
	target: string
	type: VerificationCodeType
	code: string
	isUsed: boolean
	usedAt: Date | null
	expiresAt: Date
	createdAt: Date
}

interface VerificationCodeRow {
	id: string
	target: string
	type: string
	code: string
	is_used: boolean
	used_at: Date | null
	expires_at: Date
	created_at: Date
}

const mapRowToRecord = (row: VerificationCodeRow): VerificationCodeRecord => ({
	id: row.id,
	target: row.target,
	type: row.type as VerificationCodeType,
	code: row.code,
	isUsed: row.is_used,
	usedAt: row.used_at,
	expiresAt: row.expires_at,
	createdAt: row.created_at,
})

export const verificationCodeDal = {
	/**
	 * 创建验证码记录
	 */
	async create(target: string, type: VerificationCodeType, code: string, expiresAt: Date) {
		const id = generateId()
		await execute(
			'INSERT INTO verification_codes (id, target, type, code, expires_at) VALUES (?, ?, ?, ?, ?)',
			[id, target, type, code, expiresAt],
		)
		return id
	},

	/**
	 * 根据目标和类型查询验证码
	 */
	async findByTargetAndType(
		target: string,
		type: VerificationCodeType,
	): Promise<VerificationCodeRecord | null> {
		const row = await queryOne<VerificationCodeRow>(
			'SELECT id, target, type, code, is_used, used_at, expires_at, created_at FROM verification_codes WHERE target = ? AND type = ? ORDER BY created_at DESC LIMIT 1',
			[target, type],
		)
		return row ? mapRowToRecord(row) : null
	},

	/**
	 * 根据目标、类型和验证码查询
	 */
	async findByTargetTypeAndCode(
		target: string,
		type: VerificationCodeType,
		code: string,
	): Promise<VerificationCodeRecord | null> {
		const row = await queryOne<VerificationCodeRow>(
			'SELECT id, target, type, code, is_used, used_at, expires_at, created_at FROM verification_codes WHERE target = ? AND type = ? AND code = ? ORDER BY created_at DESC LIMIT 1',
			[target, type, code],
		)
		return row ? mapRowToRecord(row) : null
	},

	/**
	 * 查询有效的验证码（未使用且未过期）
	 */
	async findValidByTargetTypeAndCode(
		target: string,
		type: VerificationCodeType,
		code: string,
	): Promise<VerificationCodeRecord | null> {
		const row = await queryOne<VerificationCodeRow>(
			'SELECT id, target, type, code, is_used, used_at, expires_at, created_at FROM verification_codes WHERE target = ? AND type = ? AND code = ? AND is_used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
			[target, type, code],
		)
		return row ? mapRowToRecord(row) : null
	},

	/**
	 * 标记验证码为已使用
	 */
	async markAsUsed(id: string): Promise<boolean> {
		const result = await execute(
			'UPDATE verification_codes SET is_used = TRUE, used_at = NOW() WHERE id = ?',
			[id],
		)
		return result.affectedRows > 0
	},

	/**
	 * 删除过期的验证码
	 */
	async deleteExpired(): Promise<number> {
		const result = await execute('DELETE FROM verification_codes WHERE expires_at < NOW()')
		return result.affectedRows
	},

	/**
	 * 删除所有验证码
	 */
	async deleteAll(): Promise<number> {
		const result = await execute('DELETE FROM verification_codes')
		return result.affectedRows
	},

	/**
	 * 删除指定目标的所有验证码
	 */
	async deleteByTarget(target: string): Promise<number> {
		const result = await execute('DELETE FROM verification_codes WHERE target = ?', [target])
		return result.affectedRows
	},

	/**
	 * 删除指定目标和类型的所有验证码
	 */
	async deleteByTargetAndType(target: string, type: VerificationCodeType): Promise<number> {
		const result = await execute('DELETE FROM verification_codes WHERE target = ? AND type = ?', [
			target,
			type,
		])
		return result.affectedRows
	},

	/**
	 * 获取未使用的验证码列表
	 */
	async listUnused(target: string, type: VerificationCodeType) {
		const rows = await query<VerificationCodeRow>(
			'SELECT id, target, type, code, is_used, used_at, expires_at, created_at FROM verification_codes WHERE target = ? AND type = ? AND is_used = FALSE ORDER BY created_at DESC',
			[target, type],
		)
		return rows.map(mapRowToRecord)
	},
}
