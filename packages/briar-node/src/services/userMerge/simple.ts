import { count, exec } from './sql'
import type { UserMergeHandler } from './types'

/**
 * 通用 handler：把 table.column 里所有 source 的行改归 target，一行声明即可。
 * 适用于「行只属于一个用户、没有按用户唯一约束」的表（站内信、审计日志等）。
 * 表不存在（模块未启用 / 旧库）时自动跳过。
 */
export const reassignColumn = (
	table: string,
	column: string,
	label: string,
	name = table,
): UserMergeHandler => ({
	name,
	label,
	claims: [{ table, column }],
	async preview(ctx) {
		if (!ctx.tables.has(table)) return { count: 0, conflicts: [], notes: [] }
		const n = await count(ctx.conn, `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, [
			ctx.source.id,
		])
		return { count: n, conflicts: [], notes: n ? ['直接改归目标用户'] : [] }
	},
	async merge(ctx) {
		if (!ctx.tables.has(table)) return { moved: 0, notes: [] }
		const moved = await exec(ctx.conn, `UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [
			ctx.target.id,
			ctx.source.id,
		])
		return { moved, notes: [] }
	},
})
