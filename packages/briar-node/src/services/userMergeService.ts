import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { transaction } from '../lib/db'
import { permissionService } from './permissionService'

/**
 * 合并用户：把 source 的登录身份、角色、自有数据与引用全部迁到 target，然后删除 source。
 * 整个过程在一个事务里，任一步失败整体回滚。
 */

export type MergeValidationError = 'MERGE_SAME_USER' | 'MERGE_SELF_SOURCE' | 'MERGE_MISSING_TARGET'

/** 纯校验：不能自己合并到自己；不能把当前登录的管理员自己合并掉（会把自己删掉） */
export const validateMerge = (input: {
	sourceId: string
	targetId: string
	currentUserId: string
}): MergeValidationError | null => {
	if (!input.targetId) return 'MERGE_MISSING_TARGET'
	if (input.sourceId === input.targetId) return 'MERGE_SAME_USER'
	if (input.sourceId === input.currentUserId) return 'MERGE_SELF_SOURCE'
	return null
}

/** 迁移步骤：[表名, SQL]；参数统一为 (target, source)。表不存在（如未启用的模块）则跳过 */
const MOVE_STEPS: [string, string][] = [
	['user_identities', 'UPDATE user_identities SET user_id = ? WHERE user_id = ?'],
	[
		'user_roles',
		'INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, role_id FROM user_roles WHERE user_id = ?',
	],
	['folders', 'UPDATE folders SET user_id = ? WHERE user_id = ?'],
	['files', 'UPDATE files SET user_id = ? WHERE user_id = ?'],
	['messages', 'UPDATE messages SET user_id = ? WHERE user_id = ?'],
	['wiki', 'UPDATE wiki SET author_id = ? WHERE author_id = ?'],
	// 自选股 (user_id, market, code) 唯一：目标已有的跳过，剩余随 source 删除级联清掉
	['market_watchlist', 'UPDATE IGNORE market_watchlist SET user_id = ? WHERE user_id = ?'],
	['sql_audit_logs', 'UPDATE sql_audit_logs SET user_id = ? WHERE user_id = ?'],
	['terminal_audit_logs', 'UPDATE terminal_audit_logs SET user_id = ? WHERE user_id = ?'],
	['request_logs', 'UPDATE request_logs SET user_id = ? WHERE user_id = ?'],
]

/** 媒体缓存按 person='u:{userId}' 归属，(person, url) 唯一：冲突的跳过并删除 source 残留 */
const PERSON_TABLES = ['media_parse_cache', 'media_cache'] as const

const exec = async (conn: PoolConnection, sql: string, params: string[]) => {
	const [res] = await conn.execute<ResultSetHeader>(sql, params)
	return res.affectedRows
}

export interface MergeResult {
	sourceId: string
	targetId: string
	moved: Record<string, number>
}

export const userMergeService = {
	async mergeUsers(sourceId: string, targetId: string): Promise<MergeResult> {
		const result = await transaction(async (conn) => {
			const [rows] = await conn.execute<RowDataPacket[]>(
				'SELECT id, avatar FROM users WHERE id IN (?, ?) FOR UPDATE',
				[sourceId, targetId],
			)
			const source = rows.find((r) => r.id === sourceId)
			const target = rows.find((r) => r.id === targetId)
			if (!source) throw new Error('MERGE_SOURCE_NOT_FOUND')
			if (!target) throw new Error('MERGE_TARGET_NOT_FOUND')

			const [tableRows] = await conn.execute<RowDataPacket[]>(
				'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
			)
			const existing = new Set(tableRows.map((r) => String(r.name)))

			const moved: Record<string, number> = {}
			for (const [name, sql] of MOVE_STEPS) {
				if (!existing.has(name)) continue
				moved[name] = await exec(conn, sql, [targetId, sourceId])
			}
			for (const table of PERSON_TABLES) {
				if (!existing.has(table)) continue
				moved[table] = await exec(conn, `UPDATE IGNORE ${table} SET person = ? WHERE person = ?`, [
					`u:${targetId}`,
					`u:${sourceId}`,
				])
				await exec(conn, `DELETE FROM ${table} WHERE person = ?`, [`u:${sourceId}`])
			}

			// 目标没有头像时沿用 source 的头像
			if (!target.avatar && source.avatar) {
				await exec(conn, 'UPDATE users SET avatar = ? WHERE id = ?', [source.avatar, targetId])
			}

			// 删除 source：user_roles 残留、冲突跳过的自选股等随外键级联删除
			const deleted = await exec(conn, 'DELETE FROM users WHERE id = ?', [sourceId])
			if (deleted !== 1) throw new Error('MERGE_SOURCE_NOT_FOUND')

			return { sourceId, targetId, moved }
		})

		permissionService.invalidateCache(sourceId)
		permissionService.invalidateCache(targetId)
		return result
	},
}
