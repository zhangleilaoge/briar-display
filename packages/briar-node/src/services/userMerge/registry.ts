/**
 * 用户合并 handler 注册表
 * ============================================================
 * 合并用户（B → A）时，userMergeService 在同一个事务里依次调用这里注册的每个 handler 的
 * preview / merge，自身不包含任何模块细节；最后删除 B。
 *
 * 新增一个「按用户存数据」的模块时：
 * 1. 简单表（行只属于一个用户、没有按用户的唯一约束）：在 USER_MERGE_HANDLERS 里加一行
 *      reassignColumn('my_table', 'user_id', '中文名')
 * 2. 有特殊语义（唯一约束去重、重名、外部存储路径…）：在 handlers.ts 写一个 UserMergeHandler，
 *    在 claims 里声明它负责的列，并加到下面的数组。
 * 3. 不需要迁移的引用（例如会随用户删除级联清掉的临时数据）：加到 IGNORED_USER_COLUMNS 并写明原因。
 *
 * 守卫测试 schemaGuard.test.ts（「用户合并 schema 守卫」）会扫描 db/schema.sql 中所有引用用户的列
 * （REFERENCES users、user_id / owner_id / author_id / created_by / person 等），
 * 未被认领也未忽略的列会让 CI 失败。
 */
import {
	filesHandler,
	identitiesHandler,
	mediaCacheHandler,
	rolesHandler,
	settingsHandler,
	watchlistHandler,
	preferencesHandler,
} from './handlers'
import { reassignColumn } from './simple'
import type { UserMergeHandler } from './types'

export const USER_MERGE_HANDLERS: UserMergeHandler[] = [
	identitiesHandler,
	rolesHandler,
	settingsHandler,
	filesHandler,
	watchlistHandler,
	mediaCacheHandler,
	reassignColumn('messages', 'user_id', '站内信'),
	preferencesHandler,
	reassignColumn('wiki', 'author_id', 'Wiki 作者'), // 旧库遗留表，不在 schema.sql 中，存在才迁移
	reassignColumn('sql_audit_logs', 'user_id', 'SQL 审计日志'),
	reassignColumn('terminal_audit_logs', 'user_id', '终端审计日志'),
	reassignColumn('request_logs', 'user_id', '请求日志'),
]

/** 引用用户但合并时刻意不处理的列：{ 'table.column': 原因 } */
export const IGNORED_USER_COLUMNS: Record<string, string> = {
	'users.id': '用户表本身，由合并服务删除源用户',
	'user_merge_logs.operator_id': '合并记录快照：执行合并的管理员 id（审计原文），不改写',
	'user_merge_logs.source_user_id': '合并记录快照：源用户合并后已删除，id 原样保留作历史',
	'user_merge_logs.target_user_id':
		'合并记录快照：保留当时的目标用户 id，不随之后的合并改写（个人中心按此 id 展示合并历史）',
	'terminal_audit_logs.user_name':
		'操作时的用户名快照（审计原文），不改写；user_id 已由审计日志 handler 迁移',
}
