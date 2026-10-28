import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { type MergeLogConflict, type UserSnapshot, userMergeLogDal } from '../dal/userMergeLogDal'
import { query, transaction } from '../lib/db'
import { permissionService } from './permissionService'
import { USER_MERGE_HANDLERS } from './userMerge/registry'
import type { MergeContext, MergeUserRow, ModulePreview, UserMergeHandler } from './userMerge/types'

/**
 * 合并用户：source（B）→ target（A）。
 * 只负责编排：在一个事务里依次调用 userMerge/registry.ts 注册的每个 handler，最后删除 source；
 * 模块细节（去重、重名、存储路径等）全部在各 handler 里。任一步失败整体回滚。
 */

export type MergeValidationError = 'MERGE_SAME_USER' | 'MERGE_SELF_SOURCE' | 'MERGE_MISSING_TARGET'

/** 纯校验：不能合并到自己；不能把当前登录的管理员自己合并掉 */
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

const toUserRow = (r: RowDataPacket): MergeUserRow => ({
	id: r.id,
	name: r.name,
	email: r.email,
	avatar: r.avatar ?? null,
	passwordHash: r.password_hash,
	hasPassword: r.has_password === null || r.has_password === undefined ? true : !!r.has_password,
	securityPasswordHash: r.security_password_hash ?? null,
})

const buildContext = async (
	conn: PoolConnection,
	sourceId: string,
	targetId: string,
	lock: boolean,
	afterCommit: MergeContext['afterCommit'],
): Promise<MergeContext> => {
	const [users] = await conn.execute<RowDataPacket[]>(
		`SELECT id, name, email, avatar, password_hash, has_password, security_password_hash
		 FROM users WHERE id IN (?, ?) AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
		[sourceId, targetId],
	)
	const source = users.find((u) => u.id === sourceId)
	const target = users.find((u) => u.id === targetId)
	if (!source) throw new Error('MERGE_SOURCE_NOT_FOUND')
	if (!target) throw new Error('MERGE_TARGET_NOT_FOUND')
	const [tableRows] = await conn.execute<RowDataPacket[]>(
		'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
	)
	return {
		conn,
		source: toUserRow(source),
		target: toUserRow(target),
		tables: new Set(tableRows.map((r) => String(r.name))),
		afterCommit,
	}
}

export interface MergePreviewModule extends ModulePreview {
	name: string
	label: string
}

export interface MergePreview {
	source: { id: string; name: string; email: string }
	target: { id: string; name: string; email: string }
	modules: MergePreviewModule[]
}

export interface MergeResult {
	sourceId: string
	targetId: string
	modules: { name: string; label: string; moved: number; notes: string[] }[]
}

class PreviewRollback extends Error {}

export const userMergeService = {
	handlers: USER_MERGE_HANDLERS as UserMergeHandler[],

	/** 预览：各模块将迁移的数量与冲突，不做任何修改（事务内只读，最后回滚） */
	async previewMerge(sourceId: string, targetId: string): Promise<MergePreview> {
		let preview: MergePreview | null = null
		try {
			await transaction(async (conn) => {
				const ctx = await buildContext(conn, sourceId, targetId, false, () => undefined)
				const modules: MergePreviewModule[] = []
				for (const h of userMergeService.handlers) {
					modules.push({ name: h.name, label: h.label, ...(await h.preview(ctx)) })
				}
				preview = {
					source: { id: ctx.source.id, name: ctx.source.name, email: ctx.source.email },
					target: { id: ctx.target.id, name: ctx.target.name, email: ctx.target.email },
					modules,
				}
				throw new PreviewRollback()
			})
		} catch (err) {
			if (!(err instanceof PreviewRollback)) throw err
		}
		return preview as unknown as MergePreview
	},

	/**
	 * 执行合并并落一条 user_merge_logs：成功时与业务同事务之后写入；
	 * 失败时事务已回滚，在事务外写一条 failed 记录（写日志本身失败不掩盖原错误）。
	 */
	async mergeUsers(
		sourceId: string,
		targetId: string,
		operator: UserSnapshot,
	): Promise<MergeResult> {
		const startedAt = new Date()
		const snapshot = await snapshotUsers(sourceId, targetId)
		const afterCommitTasks: (() => Promise<void>)[] = []
		let result: MergeResult
		let conflicts: MergeLogConflict[] = []
		try {
			result = await transaction(async (conn) => {
				const ctx = await buildContext(conn, sourceId, targetId, true, (task) => {
					afterCommitTasks.push(task)
				})
				const modules: MergeResult['modules'] = []
				const found: MergeLogConflict[] = []
				for (const h of userMergeService.handlers) {
					// 先记下合并前的冲突说明（写入合并记录），再执行合并
					const pv = await h.preview(ctx)
					for (const message of pv.conflicts)
						found.push({ module: h.name, label: h.label, message })
					modules.push({ name: h.name, label: h.label, ...(await h.merge(ctx)) })
				}
				const [del] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
					// 源用户软删除（保留行；email_active 置空后邮箱可再注册）
					'UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
					[sourceId],
				)
				if (del.affectedRows !== 1) throw new Error('MERGE_SOURCE_NOT_FOUND')
				conflicts = found
				return { sourceId, targetId, modules }
			})
		} catch (err) {
			await userMergeLogDal
				.create({
					operator,
					...snapshot,
					modules: [],
					conflicts,
					status: 'failed',
					error: err instanceof Error ? err.message : String(err),
					startedAt,
					finishedAt: new Date(),
				})
				.catch((logErr) => console.error('[userMerge] 写失败记录出错:', logErr))
			throw err
		}

		await userMergeLogDal
			.create({
				operator,
				...snapshot,
				modules: result.modules,
				conflicts,
				status: 'success',
				startedAt,
				finishedAt: new Date(),
			})
			.catch((logErr) => console.error('[userMerge] 写合并记录出错:', logErr))

		permissionService.invalidateCache(sourceId)
		permissionService.invalidateCache(targetId)
		// 事务已提交：执行外部副作用（对象存储搬迁），后台进行，失败只记日志、不影响已完成的合并
		for (const task of afterCommitTasks) {
			void task().catch((err) => console.error('[userMerge] afterCommit 任务失败:', err))
		}
		return result
	},
}

/** 合并前的双方名字/邮箱快照（源用户合并后会被软删除）；不存在的用户只留 id */
const snapshotUsers = async (sourceId: string, targetId: string) => {
	const users = await query<{ id: string; name: string; email: string }>(
		'SELECT id, name, email FROM users WHERE id IN (?, ?)',
		[sourceId, targetId],
	)
	const pick = (id: string): UserSnapshot => {
		const u = users.find((x) => x.id === id)
		return { id, name: u?.name ?? '', email: u?.email ?? '' }
	}
	return { source: pick(sourceId), target: pick(targetId) }
}
