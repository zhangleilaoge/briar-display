import { generateId } from '@briar/shared'
import { execute, queryOne } from '../lib/db'

export const KIMI_API_KEY_NAME = 'kimi_api_key'

export interface SiteSecretRecord {
	id: string
	name: string
	ciphertext: string
	hint: string
	updatedBy: string | null
	createdAt: Date
	updatedAt: Date
}

interface SiteSecretRow {
	id: string
	name: string
	ciphertext: string
	hint: string
	updated_by: string | null
	created_at: Date
	updated_at: Date
}

const mapRow = (row: SiteSecretRow): SiteSecretRecord => ({
	id: row.id,
	name: row.name,
	ciphertext: row.ciphertext,
	hint: row.hint,
	updatedBy: row.updated_by,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
})

export const siteSecretDal = {
	async findActive(name: string): Promise<SiteSecretRecord | null> {
		const row = await queryOne<SiteSecretRow>(
			`SELECT id, name, ciphertext, hint, updated_by, created_at, updated_at
			 FROM site_secrets WHERE name = ? AND deleted_at IS NULL LIMIT 1`,
			[name],
		)
		return row ? mapRow(row) : null
	},

	/** 覆盖写入：已有未删除行则 UPDATE；否则 INSERT（软删行不复活，另建新行） */
	async upsert(data: {
		name: string
		ciphertext: string
		hint: string
		updatedBy: string | null
	}): Promise<SiteSecretRecord> {
		const existing = await siteSecretDal.findActive(data.name)
		if (existing) {
			await execute(
				`UPDATE site_secrets
				 SET ciphertext = ?, hint = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
				 WHERE id = ? AND deleted_at IS NULL`,
				[data.ciphertext, data.hint, data.updatedBy, existing.id],
			)
			const row = await siteSecretDal.findActive(data.name)
			if (!row) throw new Error('Failed to update site secret')
			return row
		}
		const id = generateId()
		await execute(
			`INSERT INTO site_secrets (id, name, ciphertext, hint, updated_by)
			 VALUES (?, ?, ?, ?, ?)`,
			[id, data.name, data.ciphertext, data.hint, data.updatedBy],
		)
		const row = await siteSecretDal.findActive(data.name)
		if (!row) throw new Error('Failed to create site secret')
		return row
	},

	async softDelete(name: string): Promise<boolean> {
		const result = await execute(
			`UPDATE site_secrets SET deleted_at = CURRENT_TIMESTAMP
			 WHERE name = ? AND deleted_at IS NULL`,
			[name],
		)
		return result.affectedRows > 0
	},
}
