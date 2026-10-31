import { userDal } from '../dal/userDal'
import { execute, queryOne } from '../lib/db'

export const canManageAccount = (input: {
	operatorId: string
	targetId: string
	operatorLevel: number
	targetLevel: number
}) => input.operatorId !== input.targetId && input.operatorLevel > input.targetLevel

const getHighestRoleLevel = async (userId: string) => {
	const row = await queryOne<{ level: number | null }>(
		`SELECT MAX(r.level) AS level FROM user_roles ur
		 INNER JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
		 WHERE ur.user_id = ? AND ur.deleted_at IS NULL`,
		[userId],
	)
	return row?.level ?? 0
}

export const accountService = {
	async setStatus(operatorId: string, targetId: string, disabled: boolean) {
		const target = await userDal.findById(targetId)
		if (!target) throw new Error('USER_NOT_FOUND')

		const [operatorLevel, targetLevel] = await Promise.all([
			getHighestRoleLevel(operatorId),
			getHighestRoleLevel(targetId),
		])
		if (!canManageAccount({ operatorId, targetId, operatorLevel, targetLevel })) {
			throw new Error('ACCOUNT_STATUS_FORBIDDEN')
		}

		await execute(
			`UPDATE users SET disabled_at = ${disabled ? 'NOW()' : 'NULL'},
			 token_version = token_version + ${disabled ? '1' : '0'}
			 WHERE id = ? AND deleted_at IS NULL`,
			[targetId],
		)
		return userDal.findById(targetId)
	},
}
