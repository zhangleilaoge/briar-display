import { messageDal } from '../dal/messageDal'
import { roleDal } from '../dal/roleDal'
import { userRoleDal } from '../dal/userRoleDal'
import { query } from '../lib/db'

const listAdminUserIds = async (): Promise<string[]> => {
	const adminRole = await roleDal.findByName('admin')
	if (!adminRole) {
		console.warn('[guestbook-notify] admin 角色不存在，跳过站内信')
		return []
	}
	const roleUserIds = await userRoleDal.getRoleUserIds(adminRole.id)
	if (roleUserIds.length === 0) return []
	const placeholders = roleUserIds.map(() => '?').join(', ')
	const rows = await query<{ id: string }>(
		`SELECT id FROM users WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
		roleUserIds,
	)
	return rows.map((r) => r.id)
}

/** 新待审留言 → 给全部管理员发站内信 */
export async function notifyAdminsNewGuestbook(entry: {
	id: string
	nickname: string
	content: string
}): Promise<number> {
	const adminIds = await listAdminUserIds()
	const preview = entry.content.length > 80 ? `${entry.content.slice(0, 80)}…` : entry.content
	const title = '留言墙有新待审'
	const content = `${entry.nickname}：${preview}\n\n请到首页留言墙审核（通过后才会公开展示）。`
	for (const userId of adminIds) {
		await messageDal.create({
			userId,
			type: 'guestbook',
			title,
			content,
		})
	}
	return adminIds.length
}
