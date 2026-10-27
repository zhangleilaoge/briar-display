import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export type IdentityProvider = 'google'

export interface UserIdentityRecord {
	id: string
	userId: string
	provider: IdentityProvider
	providerUid: string
	email: string | null
	createdAt: Date
}

interface UserIdentityRow {
	id: string
	user_id: string
	provider: IdentityProvider
	provider_uid: string
	email: string | null
	created_at: Date
}

const mapRow = (row: UserIdentityRow): UserIdentityRecord => ({
	id: row.id,
	userId: row.user_id,
	provider: row.provider,
	providerUid: row.provider_uid,
	email: row.email,
	createdAt: row.created_at,
})

const COLUMNS = 'id, user_id, provider, provider_uid, email, created_at'

export const userIdentityDal = {
	async findByProviderUid(
		provider: IdentityProvider,
		providerUid: string,
	): Promise<UserIdentityRecord | null> {
		const row = await queryOne<UserIdentityRow>(
			`SELECT ${COLUMNS} FROM user_identities WHERE provider = ? AND provider_uid = ?`,
			[provider, providerUid],
		)
		return row ? mapRow(row) : null
	},

	async listByUser(userId: string): Promise<UserIdentityRecord[]> {
		const rows = await query<UserIdentityRow>(
			`SELECT ${COLUMNS} FROM user_identities WHERE user_id = ? ORDER BY created_at`,
			[userId],
		)
		return rows.map(mapRow)
	},

	async create(data: {
		userId: string
		provider: IdentityProvider
		providerUid: string
		email?: string | null
	}): Promise<UserIdentityRecord> {
		const id = generateId()
		await execute(
			'INSERT INTO user_identities (id, user_id, provider, provider_uid, email) VALUES (?, ?, ?, ?, ?)',
			[id, data.userId, data.provider, data.providerUid, data.email ?? null],
		)
		const row = await queryOne<UserIdentityRow>(
			`SELECT ${COLUMNS} FROM user_identities WHERE id = ?`,
			[id],
		)
		if (!row) throw new Error('Failed to create identity')
		return mapRow(row)
	},

	async deleteByUserProvider(userId: string, provider: IdentityProvider): Promise<number> {
		const result = await execute('DELETE FROM user_identities WHERE user_id = ? AND provider = ?', [
			userId,
			provider,
		])
		return result.affectedRows
	},
}
