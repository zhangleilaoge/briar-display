import { describe, expect, test } from 'bun:test'
import fs from 'fs'
import path from 'path'

/**
 * 约定：业务数据一律软删除（deleted_at），见 AGENTS.md「数据删除约定」。
 * 只有下列纯缓存 / 日志保留 / 短期凭证表允许物理 DELETE；新增例外必须在这里写明理由。
 */
const HARD_DELETE_WHITELIST: Record<string, string> = {
	verification_codes: '短期验证码，过期/用完即清理（安全考虑，不留存）',
	request_logs: '请求日志按天数保留，定期清理',
	scheduler_runs: '定时任务运行记录按天数保留，定期清理',
	cert_renewal_logs: '证书续期日志按天数保留，定期清理',
	media_cache: '媒体解析缓存（LRU 淘汰，与 COS 对象同步清理）',
	media_parse_cache: '媒体解析缓存（随 media_cache 清理）',
	// services/userMerge/handlers.ts：遍历 MEDIA_TABLES（即上面两张缓存表）去重
	'${t}': '动态表名，仅用于 MEDIA_TABLES 缓存表',
	// services/userMerge/handlers.ts：偏好表无 deleted_at，合并去重后硬删源用户残留
	user_preferences: '用户偏好 KV（无软删列；合并时 UPDATE IGNORE 后硬删源用户重复键）',
}

/** 已改为软删除的业务表：schema.sql 中必须有 deleted_at */
const SOFT_DELETE_TABLES = [
	'users',
	'roles',
	'permissions',
	'role_permissions',
	'user_roles',
	'folders',
	'files',
	'messages',
	'market_watchlist',
	'user_identities',
]

const SRC = path.resolve(import.meta.dir, '..')

const walk = (dir: string): string[] =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.join(dir, e.name)
		if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
		return /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [p] : []
	})

describe('软删除约定', () => {
	test('源码中的 DELETE FROM 只允许作用于白名单表', () => {
		const offenders: string[] = []
		// 只匹配大写 SQL（项目约定 SQL 关键字大写），避免误伤注释里的英文 "Delete from COS"
		for (const file of walk(SRC)) {
			const text = fs.readFileSync(file, 'utf-8')
			for (const m of text.matchAll(/DELETE\s+FROM\s+`?(\$\{\w+\}|\w+)`?/g)) {
				if (!(m[1] in HARD_DELETE_WHITELIST)) {
					const line = text.slice(0, m.index).split('\n').length
					offenders.push(`${path.relative(SRC, file)}:${line} DELETE FROM ${m[1]}`)
				}
			}
		}
		expect(offenders).toEqual([])
	})

	test('软删除业务表在 schema.sql 中都有 deleted_at', () => {
		const schema = fs.readFileSync(path.join(SRC, 'db', 'schema.sql'), 'utf-8')
		const missing = SOFT_DELETE_TABLES.filter((t) => {
			const m = schema.match(
				new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\s*\\(([\\s\\S]*?)\\n\\)`, 'i'),
			)
			return !m || !/\bdeleted_at\b/.test(m[1])
		})
		expect(missing).toEqual([])
	})

	test('软删除业务表在 migrate.sql 之外不出现 DELETE FROM（含 SQL 文件里的一次性语句）', () => {
		const migrate = fs.readFileSync(path.join(SRC, 'db', 'migrate.sql'), 'utf-8')
		const bad = SOFT_DELETE_TABLES.filter((t) =>
			new RegExp(`DELETE\\s+FROM\\s+\`?${t}\\b`, 'i').test(migrate),
		)
		expect(bad).toEqual([])
	})
})
