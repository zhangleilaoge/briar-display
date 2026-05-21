import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export interface ReadmeAiRecord {
	id: string
	projectPath: string
	projectName: string
	content: string
	codeHash: string | null
	createdAt: Date
	updatedAt: Date
}

interface ReadmeAiRow {
	id: string
	project_path: string
	project_name: string
	content: string
	code_hash: string | null
	created_at: Date
	updated_at: Date
}

const mapRowToRecord = (row: ReadmeAiRow): ReadmeAiRecord => ({
	id: row.id,
	projectPath: row.project_path,
	projectName: row.project_name,
	content: row.content,
	codeHash: row.code_hash,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

export const readmeAiDal = {
	async findByProjectPath(projectPath: string): Promise<ReadmeAiRecord | null> {
		const row = await queryOne<ReadmeAiRow>(
			'SELECT id, project_path, project_name, content, code_hash, created_at, updated_at FROM readme_ai WHERE project_path = ?',
			[projectPath],
		)
		return row ? mapRowToRecord(row) : null
	},

	async findByProjectName(projectName: string): Promise<ReadmeAiRecord | null> {
		const row = await queryOne<ReadmeAiRow>(
			'SELECT id, project_path, project_name, content, code_hash, created_at, updated_at FROM readme_ai WHERE project_name = ?',
			[projectName],
		)
		return row ? mapRowToRecord(row) : null
	},

	async create(
		data: Omit<ReadmeAiRecord, 'id' | 'createdAt' | 'updatedAt'>,
	): Promise<ReadmeAiRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO readme_ai (id, project_path, project_name, content, code_hash) VALUES (?, ?, ?, ?, ?)',
			[id, data.projectPath, data.projectName, data.content, data.codeHash],
		)

		const record = await readmeAiDal.findById(id)
		if (!record) {
			throw new Error('Failed to create readme_ai record')
		}
		return record
	},

	async update(
		id: string,
		data: Partial<Omit<ReadmeAiRecord, 'id' | 'createdAt' | 'updatedAt'>>,
	): Promise<ReadmeAiRecord | null> {
		const updates: string[] = []
		const values: any[] = []

		if (data.projectPath !== undefined) {
			updates.push('project_path = ?')
			values.push(data.projectPath)
		}
		if (data.projectName !== undefined) {
			updates.push('project_name = ?')
			values.push(data.projectName)
		}
		if (data.content !== undefined) {
			updates.push('content = ?')
			values.push(data.content)
		}
		if (data.codeHash !== undefined) {
			updates.push('code_hash = ?')
			values.push(data.codeHash)
		}

		if (updates.length === 0) {
			return readmeAiDal.findById(id)
		}

		values.push(id)
		await execute(`UPDATE readme_ai SET ${updates.join(', ')} WHERE id = ?`, values)

		return readmeAiDal.findById(id)
	},

	async delete(id: string): Promise<boolean> {
		const result = await execute('DELETE FROM readme_ai WHERE id = ?', [id])
		return result.affectedRows > 0
	},

	async findById(id: string): Promise<ReadmeAiRecord | null> {
		const row = await queryOne<ReadmeAiRow>(
			'SELECT id, project_path, project_name, content, code_hash, created_at, updated_at FROM readme_ai WHERE id = ?',
			[id],
		)
		return row ? mapRowToRecord(row) : null
	},

	async list(limit = 100, offset = 0): Promise<ReadmeAiRecord[]> {
		const rows = await query<ReadmeAiRow>(
			`SELECT id, project_path, project_name, content, code_hash, created_at, updated_at FROM readme_ai ORDER BY updated_at DESC LIMIT ${Math.floor(limit)} OFFSET ${Math.floor(offset)}`,
		)
		return rows.map(mapRowToRecord)
	},
}
