import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IGNORED_USER_COLUMNS, USER_MERGE_HANDLERS } from './registry'
import { findUserColumns } from './schemaGuard'

/**
 * 用户合并 schema 守卫：扫描 db/schema.sql 里所有「引用用户」的列，
 * 每一列都必须被某个合并 handler 认领（claims），或在 IGNORED_USER_COLUMNS 中写明原因。
 * 新增按用户存数据的表却忘了处理合并 → 这里失败，CI 拦截。
 */

const schemaSql = readFileSync(join(import.meta.dir, '../../db/schema.sql'), 'utf8')
const migrateSql = readFileSync(join(import.meta.dir, '../../db/migrate.sql'), 'utf8')
const claimed = new Set(
	USER_MERGE_HANDLERS.flatMap((h) => h.claims.map((c) => `${c.table}.${c.column}`)),
)

describe('用户合并 schema 守卫：每个引用用户的表都必须有合并处理', () => {
	const userColumns = findUserColumns(schemaSql)

	it('能识别出已知的用户引用列（解析器自检）', () => {
		for (const col of [
			'files.user_id',
			'folders.user_id',
			'user_roles.user_id',
			'user_identities.user_id',
		]) {
			expect(userColumns).toContain(col)
		}
	})

	it('新表的 owner_id / 指向 users 的外键会被识别（未处理时会让守卫失败）', () => {
		const cols = findUserColumns(
			'CREATE TABLE IF NOT EXISTS notes (\n  id INT,\n  owner_id VARCHAR(36),\n  writer VARCHAR(36),\n  FOREIGN KEY (writer) REFERENCES users(id)\n) ENGINE=InnoDB;',
		)
		expect(cols).toContain('notes.owner_id')
		expect(cols).toContain('notes.writer')
		expect(cols.filter((c) => !claimed.has(c) && !(c in IGNORED_USER_COLUMNS))).toEqual([
			'notes.owner_id',
			'notes.writer',
		])
	})

	it('schema.sql 中每个引用用户的列都被 handler 认领或列入忽略清单', () => {
		const missing = userColumns.filter((c) => !claimed.has(c) && !(c in IGNORED_USER_COLUMNS))
		expect(missing).toEqual([])
	})

	it('migrate.sql 里新增的用户引用列也已写进 schema.sql（结构变更必须同步 schema.sql）', () => {
		const inSchema = new Set(userColumns)
		expect(findUserColumns(migrateSql).filter((c) => !inSchema.has(c))).toEqual([])
	})

	it('忽略清单每项都写明原因', () => {
		for (const [col, reason] of Object.entries(IGNORED_USER_COLUMNS)) {
			expect(col).toMatch(/^\w+\.\w+$/)
			expect(reason.trim().length).toBeGreaterThan(4)
		}
	})

	it('一列只能由一个 handler 认领，且不能同时被忽略', () => {
		const all = USER_MERGE_HANDLERS.flatMap((h) => h.claims.map((c) => `${c.table}.${c.column}`))
		expect(all.length).toBe(new Set(all).size)
		expect(all.filter((c) => c in IGNORED_USER_COLUMNS)).toEqual([])
	})

	it('handler 名称唯一', () => {
		const names = USER_MERGE_HANDLERS.map((h) => h.name)
		expect(names.length).toBe(new Set(names).size)
	})
})
