import { randomUUID } from 'node:crypto'
import { execute } from '../../lib/db'
import { cosService } from '../cosService'
import { count, exec, rows } from './sql'
import type { MergeContext, UserMergeHandler } from './types'

const none = { count: 0, conflicts: [] as string[], notes: [] as string[] }

// ==================== 登录身份 ====================

export const identitiesHandler: UserMergeHandler = {
	name: 'identities',
	label: '登录身份（Google 等）',
	claims: [{ table: 'user_identities', column: 'user_id' }],
	async preview(ctx) {
		if (!ctx.tables.has('user_identities')) return none
		const src = await rows<{ provider: string; email: string | null }>(
			ctx.conn,
			'SELECT provider, email FROM user_identities WHERE user_id = ? AND deleted_at IS NULL',
			[ctx.source.id],
		)
		const tgt = await rows<{ provider: string }>(
			ctx.conn,
			'SELECT provider FROM user_identities WHERE user_id = ? AND deleted_at IS NULL',
			[ctx.target.id],
		)
		const conflicts = src
			.filter((s) => tgt.some((t) => t.provider === s.provider))
			.map((s) => `目标用户已绑定 ${s.provider}，合并后两个 ${s.provider} 账号都会登录到目标用户`)
		return {
			count: src.length,
			conflicts,
			notes: src.map((s) => `${s.provider}（${s.email ?? '无邮箱'}）改为登录目标用户`),
		}
	},
	async merge(ctx) {
		if (!ctx.tables.has('user_identities')) return { moved: 0, notes: [] }
		const moved = await exec(ctx.conn, 'UPDATE user_identities SET user_id = ? WHERE user_id = ?', [
			ctx.target.id,
			ctx.source.id,
		])
		return { moved, notes: [] }
	},
}

// ==================== 角色：取并集（保留更高的） ====================

export const rolesHandler: UserMergeHandler = {
	name: 'roles',
	label: '角色',
	claims: [{ table: 'user_roles', column: 'user_id' }],
	async preview(ctx) {
		const added = await rows<{ display_name: string; level: number | null }>(
			ctx.conn,
			`SELECT r.display_name, r.level FROM user_roles ur JOIN roles r ON r.id = ur.role_id
			 WHERE ur.user_id = ? AND ur.deleted_at IS NULL AND r.deleted_at IS NULL
			   AND ur.role_id NOT IN (SELECT role_id FROM user_roles WHERE user_id = ? AND deleted_at IS NULL)`,
			[ctx.source.id, ctx.target.id],
		)
		return {
			count: added.length,
			conflicts: [],
			notes: added.length
				? [
						`目标用户将新增角色：${added.map((r) => r.display_name).join('、')}（取并集，更高的角色保留）`,
					]
				: ['源用户没有目标用户缺少的角色，目标角色不变'],
		}
	},
	async merge(ctx) {
		// 并集：目标原有角色不动，补上源用户独有的角色 → 两者中更高的角色一定保留
		const moved = await exec(
			ctx.conn,
			`INSERT INTO user_roles (user_id, role_id)
			 SELECT ?, role_id FROM user_roles WHERE user_id = ? AND deleted_at IS NULL
			 ON DUPLICATE KEY UPDATE deleted_at = NULL`,
			[ctx.target.id, ctx.source.id],
		)
		await exec(
			ctx.conn,
			'UPDATE user_roles SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL',
			[ctx.source.id],
		)
		return { moved, notes: [] }
	},
}

// ==================== 文件 / 文件夹 ====================

/** 「合并自 <B>」文件夹名：与目标根目录已有文件夹重名时追加 (2)、(3)… */
export const pickMergeFolderName = (sourceName: string, existing: string[]) => {
	const base = `合并自 ${sourceName}`.slice(0, 240)
	const taken = new Set(existing)
	if (!taken.has(base)) return base
	for (let i = 2; ; i++) {
		const name = `${base} (${i})`
		if (!taken.has(name)) return name
	}
}

/** 存储 key 约定 files/{userId}/{uuid}.{ext}：换成目标用户前缀 */
export const relocateKey = (key: string, sourceId: string, targetId: string) => {
	const prefix = `files/${sourceId}/`
	return key.startsWith(prefix) ? `files/${targetId}/${key.slice(prefix.length)}` : null
}

const rootFolderNames = async (ctx: MergeContext) =>
	(
		await rows<{ name: string }>(
			ctx.conn,
			'SELECT name FROM folders WHERE user_id = ? AND parent_id IS NULL AND deleted_at IS NULL',
			[ctx.target.id],
		)
	).map((r) => r.name)

/** 提交后搬迁对象存储：先复制 → 更新 DB → 再删旧对象；任一步失败保留旧 key（文件仍可访问） */
const relocateObjects = async (
	files: { id: string; filename: string; mime_type: string }[],
	sourceId: string,
	targetId: string,
) => {
	let ok = 0
	let failed = 0
	for (const f of files) {
		const newKey = relocateKey(f.filename, sourceId, targetId)
		if (!newKey) continue
		try {
			await cosService.copyObject(f.filename, newKey)
			const isVideo = f.mime_type.startsWith('video/')
			if (isVideo) {
				await cosService
					.copyObject(cosService.getCoverKey(f.filename), cosService.getCoverKey(newKey))
					.catch(() => undefined) // 封面可能不存在
			}
			await execute(
				`UPDATE files SET filename = ?, cdn_url = REPLACE(cdn_url, ?, ?),
				 thumbnail_url = REPLACE(thumbnail_url, ?, ?) WHERE id = ? AND filename = ?`,
				[newKey, f.filename, newKey, f.filename, newKey, f.id, f.filename],
			)
			await cosService.deleteFileWithCover(f.filename, f.mime_type)
			ok++
		} catch (err) {
			failed++
			console.error('[userMerge] 文件对象搬迁失败，保留原 key:', f.id, err)
		}
	}
	console.log(`[userMerge] 文件对象搬迁完成：成功 ${ok}，失败 ${failed}`)
}

export const filesHandler: UserMergeHandler = {
	name: 'files',
	label: '文件与文件夹',
	claims: [
		{ table: 'folders', column: 'user_id' },
		{ table: 'files', column: 'user_id' },
	],
	async preview(ctx) {
		const folders = await count(
			ctx.conn,
			'SELECT COUNT(*) AS n FROM folders WHERE user_id = ? AND deleted_at IS NULL',
			[ctx.source.id],
		)
		const files = await count(ctx.conn, 'SELECT COUNT(*) AS n FROM files WHERE user_id = ?', [
			ctx.source.id,
		])
		if (!folders && !files) return { ...none, notes: ['源用户没有文件'] }
		const folderName = pickMergeFolderName(ctx.source.name, await rootFolderNames(ctx))
		const keys = await count(
			ctx.conn,
			'SELECT COUNT(*) AS n FROM files WHERE user_id = ? AND filename LIKE ?',
			[ctx.source.id, `files/${ctx.source.id}/%`],
		)
		return {
			count: folders + files,
			conflicts:
				folderName !== `合并自 ${ctx.source.name}`
					? [`根目录已有同名文件夹，将命名为「${folderName}」`]
					: [],
			notes: [
				`${files} 个文件、${folders} 个文件夹整体放进目标根目录新建的「${folderName}」，保留原目录结构，不覆盖任何已有文件`,
				`${keys} 个存储对象的路径含源用户 ID，合并后自动搬到目标用户路径`,
			],
		}
	},
	async merge(ctx) {
		const folders = await count(
			ctx.conn,
			'SELECT COUNT(*) AS n FROM folders WHERE user_id = ? AND deleted_at IS NULL',
			[ctx.source.id],
		)
		const files = await count(ctx.conn, 'SELECT COUNT(*) AS n FROM files WHERE user_id = ?', [
			ctx.source.id,
		])
		if (!folders && !files) return { moved: 0, notes: [] }

		const folderName = pickMergeFolderName(ctx.source.name, await rootFolderNames(ctx))
		const mergeFolderId = randomUUID()
		await exec(
			ctx.conn,
			'INSERT INTO folders (id, user_id, name, parent_id) VALUES (?, ?, ?, NULL)',
			[mergeFolderId, ctx.target.id, folderName],
		)
		// 源用户根目录下的文件夹/文件挂到「合并自 <B>」下，子层级原样保留 → 不会与目标已有内容重名
		const movedFolders = await exec(
			ctx.conn,
			'UPDATE folders SET user_id = ?, parent_id = COALESCE(parent_id, ?) WHERE user_id = ?',
			[ctx.target.id, mergeFolderId, ctx.source.id],
		)
		const toRelocate = await rows<{ id: string; filename: string; mime_type: string }>(
			ctx.conn,
			'SELECT id, filename, mime_type FROM files WHERE user_id = ? AND filename LIKE ?',
			[ctx.source.id, `files/${ctx.source.id}/%`],
		)
		const movedFiles = await exec(
			ctx.conn,
			'UPDATE files SET user_id = ?, folder_id = COALESCE(folder_id, ?) WHERE user_id = ?',
			[ctx.target.id, mergeFolderId, ctx.source.id],
		)
		const sourceId = ctx.source.id
		const targetId = ctx.target.id
		if (toRelocate.length) {
			ctx.afterCommit(() => relocateObjects(toRelocate, sourceId, targetId))
		}
		return {
			moved: movedFolders + movedFiles,
			notes: [`放入「${folderName}」`, `${toRelocate.length} 个存储对象后台搬迁`],
		}
	},
}

// ==================== 自选股：去重 ====================

export const watchlistHandler: UserMergeHandler = {
	name: 'watchlist',
	label: '行情自选股',
	claims: [{ table: 'market_watchlist', column: 'user_id' }],
	async preview(ctx) {
		if (!ctx.tables.has('market_watchlist')) return none
		const total = await count(
			ctx.conn,
			'SELECT COUNT(*) AS n FROM market_watchlist WHERE user_id = ? AND deleted_at IS NULL',
			[ctx.source.id],
		)
		const dup = await count(
			ctx.conn,
			`SELECT COUNT(*) AS n FROM market_watchlist s JOIN market_watchlist t
			 ON t.user_id = ? AND t.market = s.market AND t.code = s.code AND t.deleted_at IS NULL
			 WHERE s.user_id = ? AND s.deleted_at IS NULL`,
			[ctx.target.id, ctx.source.id],
		)
		return {
			count: total - dup,
			conflicts: dup ? [`${dup} 只股票双方都有，保留目标用户那条`] : [],
			notes: total ? [`并入 ${total - dup} 只`] : [],
		}
	},
	async merge(ctx) {
		if (!ctx.tables.has('market_watchlist')) return { moved: 0, notes: [] }
		// (user_id, market, code) 唯一（含已软删除行）：
		// 1) 目标已软删除、源未删除的同一只股票 → 复活目标那条
		const revived = await exec(
			ctx.conn,
			`UPDATE market_watchlist t JOIN market_watchlist s
			   ON s.user_id = ? AND s.market = t.market AND s.code = t.code AND s.deleted_at IS NULL
			 SET t.name = s.name, t.created_at = NOW(), t.deleted_at = NULL
			 WHERE t.user_id = ? AND t.deleted_at IS NOT NULL`,
			[ctx.source.id, ctx.target.id],
		)
		// 2) 其余搬到目标用户，重复的 UPDATE IGNORE 跳过；3) 源用户残留（重复项）软删除
		const movedRest = await exec(
			ctx.conn,
			'UPDATE IGNORE market_watchlist SET user_id = ? WHERE user_id = ?',
			[ctx.target.id, ctx.source.id],
		)
		const moved = movedRest + revived
		const dropped = await exec(
			ctx.conn,
			'UPDATE market_watchlist SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL',
			[ctx.source.id],
		)
		return { moved, notes: dropped ? [`去重丢弃 ${dropped} 条重复`] : [] }
	},
}

// ==================== 媒体解析缓存：person = 'u:{userId}'，去重 ====================

const MEDIA_TABLES = ['media_parse_cache', 'media_cache'] as const

export const mediaCacheHandler: UserMergeHandler = {
	name: 'mediaCache',
	label: '媒体解析缓存',
	claims: MEDIA_TABLES.map((table) => ({ table, column: 'person' })),
	async preview(ctx) {
		let total = 0
		for (const t of MEDIA_TABLES) {
			if (!ctx.tables.has(t)) continue
			total += await count(ctx.conn, `SELECT COUNT(*) AS n FROM ${t} WHERE person = ?`, [
				`u:${ctx.source.id}`,
			])
		}
		return { count: total, conflicts: [], notes: total ? ['同一链接双方都有缓存时保留目标的'] : [] }
	},
	async merge(ctx) {
		let moved = 0
		for (const t of MEDIA_TABLES) {
			if (!ctx.tables.has(t)) continue
			moved += await exec(ctx.conn, `UPDATE IGNORE ${t} SET person = ? WHERE person = ?`, [
				`u:${ctx.target.id}`,
				`u:${ctx.source.id}`,
			])
			await exec(ctx.conn, `DELETE FROM ${t} WHERE person = ?`, [`u:${ctx.source.id}`])
		}
		return { moved, notes: [] }
	},
}

// ==================== 账号设置：目标优先，仅补空 ====================

/** 目标优先：只有目标为空、源有值的字段才补过来（纯函数，便于测试） */
export const pickSettingsFill = (ctx: Pick<MergeContext, 'source' | 'target'>) => {
	const fill: { avatar?: string; securityPasswordHash?: string; passwordHash?: string } = {}
	if (!ctx.target.avatar && ctx.source.avatar) fill.avatar = ctx.source.avatar
	if (!ctx.target.securityPasswordHash && ctx.source.securityPasswordHash) {
		fill.securityPasswordHash = ctx.source.securityPasswordHash
	}
	if (!ctx.target.hasPassword && ctx.source.hasPassword) fill.passwordHash = ctx.source.passwordHash
	return fill
}

const FILL_LABELS = {
	avatar: '头像',
	securityPasswordHash: '隐私密码',
	passwordHash: '登录密码',
} as const


// ==================== 用户偏好：同 key 保留目标 ====================

export const preferencesHandler: UserMergeHandler = {
	name: 'preferences',
	label: '用户偏好',
	claims: [{ table: 'user_preferences', column: 'user_id' }],
	async preview(ctx) {
		if (!ctx.tables.has('user_preferences')) return none
		const total = await count(
			ctx.conn,
			'SELECT COUNT(*) AS n FROM user_preferences WHERE user_id = ?',
			[ctx.source.id],
		)
		const dup = await count(
			ctx.conn,
			`SELECT COUNT(*) AS n FROM user_preferences s JOIN user_preferences t
			 ON t.user_id = ? AND t.pref_key = s.pref_key
			 WHERE s.user_id = ?`,
			[ctx.target.id, ctx.source.id],
		)
		return {
			count: total - dup,
			conflicts: dup ? [`${dup} 个偏好键双方都有，保留目标用户`] : [],
			notes: total ? [`并入 ${total - dup} 条`] : [],
		}
	},
	async merge(ctx) {
		if (!ctx.tables.has('user_preferences')) return { moved: 0, notes: [] }
		const moved = await exec(
			ctx.conn,
			`UPDATE IGNORE user_preferences SET user_id = ? WHERE user_id = ?`,
			[ctx.target.id, ctx.source.id],
		)
		const dropped = await exec(ctx.conn, 'DELETE FROM user_preferences WHERE user_id = ?', [
			ctx.source.id,
		])
		return {
			moved,
			notes: dropped ? [`丢弃源用户重复偏好 ${dropped} 条`] : [],
		}
	},
}

export const settingsHandler: UserMergeHandler = {
	name: 'settings',
	label: '账号设置',
	claims: [],
	async preview(ctx) {
		const fill = Object.keys(pickSettingsFill(ctx)) as (keyof typeof FILL_LABELS)[]
		return {
			count: fill.length,
			conflicts: [],
			notes: [
				`名字、邮箱等以目标用户为准${fill.length ? `；目标缺少的${fill.map((k) => FILL_LABELS[k]).join('、')}沿用源用户的` : ''}`,
			],
		}
	},
	async merge(ctx) {
		const fill = pickSettingsFill(ctx)
		if (fill.avatar)
			await exec(ctx.conn, 'UPDATE users SET avatar = ? WHERE id = ?', [fill.avatar, ctx.target.id])
		if (fill.securityPasswordHash) {
			await exec(ctx.conn, 'UPDATE users SET security_password_hash = ? WHERE id = ?', [
				fill.securityPasswordHash,
				ctx.target.id,
			])
		}
		if (fill.passwordHash) {
			await exec(ctx.conn, 'UPDATE users SET password_hash = ?, has_password = 1 WHERE id = ?', [
				fill.passwordHash,
				ctx.target.id,
			])
		}
		return { moved: Object.keys(fill).length, notes: [] }
	},
}
