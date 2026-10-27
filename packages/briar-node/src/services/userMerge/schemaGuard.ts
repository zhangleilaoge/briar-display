/** 扫描 migrate.sql 中「引用用户」的列，供 schemaGuard.test.ts 使用 */

/** 列名看起来指向用户 */
export const USER_COLUMN_RE =
	/^(user_id|owner_id|author_id|creator_id|created_by|updated_by|uploader_id|person|user_name)$|_user_id$/i

const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

/** 从 migrate.sql 提取 table.column（CREATE TABLE 列 + ALTER TABLE ADD COLUMN + REFERENCES users） */
export const findUserColumns = (sql: string) => {
	const found = new Set<string>()
	const text = stripComments(sql)

	for (const m of text.matchAll(
		/CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?\s*\(([\s\S]*?)\)\s*ENGINE/gi,
	)) {
		const [, table, body] = m
		for (const line of body.split('\n')) {
			const col = line.trim().match(/^`?(\w+)`?\s+\w+/)
			if (col && USER_COLUMN_RE.test(col[1])) found.add(`${table}.${col[1]}`)
			const fk = line.match(/FOREIGN KEY\s*\(\s*`?(\w+)`?\s*\)\s*REFERENCES\s+`?users`?\s*\(/i)
			if (fk) found.add(`${table}.${fk[1]}`)
		}
	}
	// 迁移里动态拼的 ALTER（SET @sql = 'ALTER TABLE x ADD COLUMN y ...'）
	for (const m of text.matchAll(/ALTER TABLE\s+`?(\w+)`?\s+ADD COLUMN\s+`?(\w+)`?/gi)) {
		if (USER_COLUMN_RE.test(m[2])) found.add(`${m[1]}.${m[2]}`)
	}
	for (const m of text.matchAll(
		/ALTER TABLE\s+`?(\w+)`?[\s\S]{0,200}?FOREIGN KEY\s*\(\s*`?(\w+)`?\s*\)\s*REFERENCES\s+`?users`?/gi,
	)) {
		found.add(`${m[1]}.${m[2]}`)
	}
	// users 表本身的 id 作为被引用方，单独列入
	found.add('users.id')
	return [...found].sort()
}
