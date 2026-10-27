import type { PoolConnection } from 'mysql2/promise'

/** 合并双方用户行（只取合并需要的字段） */
export interface MergeUserRow {
	id: string
	name: string
	email: string
	avatar: string | null
	passwordHash: string
	hasPassword: boolean
	securityPasswordHash: string | null
}

/** 每个 handler 拿到的上下文：同一事务连接 + 双方用户 + 库里实际存在的表 */
export interface MergeContext {
	conn: PoolConnection
	/** 被合并、最终删除的用户（B） */
	source: MergeUserRow
	/** 保留的目标用户（A） */
	target: MergeUserRow
	/** 当前库实际存在的表（模块未启用/旧库缺表时 handler 自行跳过） */
	tables: Set<string>
	/** 注册事务提交后才执行的副作用（如对象存储搬迁）；事务回滚则不会执行 */
	afterCommit: (task: () => Promise<void>) => void
}

/** 某个模块的预览：将迁移多少条 + 冲突/处理说明 */
export interface ModulePreview {
	count: number
	conflicts: string[]
	notes: string[]
}

export interface ModuleResult {
	moved: number
	notes: string[]
}

/** 一个用户数据模块的合并处理器 */
export interface UserMergeHandler {
	/** 模块标识（英文，结果里的 key） */
	name: string
	/** 中文名，给预览/结果展示 */
	label: string
	/**
	 * 本 handler 负责的「引用用户的列」。schemaGuard.test.ts 会扫描 schema.sql，
	 * 每个引用用户的列都必须被某个 handler 认领，或列入 IGNORED_USER_COLUMNS 并写明原因。
	 */
	claims: { table: string; column: string }[]
	preview: (ctx: MergeContext) => Promise<ModulePreview>
	merge: (ctx: MergeContext) => Promise<ModuleResult>
}
