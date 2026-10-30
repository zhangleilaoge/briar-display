import { execute, queryOne } from '../lib/db'

interface PrefRow {
	pref_value: unknown
}

export const userPreferenceDal = {
	async get(userId: string, key: string): Promise<unknown | null> {
		const row = await queryOne<PrefRow>(
			'SELECT pref_value FROM user_preferences WHERE user_id = ? AND pref_key = ?',
			[userId, key],
		)
		if (!row) return null
		const v = row.pref_value
		if (typeof v === 'string') {
			try {
				return JSON.parse(v)
			} catch {
				return v
			}
		}
		return v
	},

	async set(userId: string, key: string, value: unknown): Promise<void> {
		const json = JSON.stringify(value)
		await execute(
			`INSERT INTO user_preferences (user_id, pref_key, pref_value) VALUES (?, ?, CAST(? AS JSON))
			 ON DUPLICATE KEY UPDATE pref_value = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP`,
			[userId, key, json, json],
		)
	},
}
