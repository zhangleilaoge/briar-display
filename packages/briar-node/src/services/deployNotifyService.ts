import { deployRunDal } from '../dal/deployRunDal'
import { messageDal } from '../dal/messageDal'
import { roleDal } from '../dal/roleDal'
import { userRoleDal } from '../dal/userRoleDal'
import { query } from '../lib/db'
import {
	buildDeployFailMessage,
	buildDeployStartMessage,
	isCdnDeployWorkflow,
	isDeployFailedStatus,
	isDeployRunningStatus,
} from '../lib/deployNotify'
import type { DeployHistoryItem } from './deploymentService'

const resolveRepo = () => process.env.BRIAR_GITHUB_REPO || 'zhangleilaoge/briar-display'

/** 未软删的 admin 角色用户 */
const listAdminUserIds = async (): Promise<string[]> => {
	const adminRole = await roleDal.findByName('admin')
	if (!adminRole) {
		console.warn('[deploy-notify] admin 角色不存在，跳过站内信')
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

const broadcast = async (payload: {
	type: string
	title: string
	content: string
}): Promise<number> => {
	const adminIds = await listAdminUserIds()
	for (const userId of adminIds) {
		await messageDal.create({
			userId,
			type: payload.type,
			title: payload.title,
			content: payload.content,
		})
	}
	return adminIds.length
}

export const deployNotifyService = {
	/**
	 * 同步落库后：进行中的 CDN 部署发「发布开始」（幂等 claim）
	 */
	async notifyStarts(items: DeployHistoryItem[]): Promise<void> {
		for (const item of items) {
			if (!item.run) continue
			if (!isCdnDeployWorkflow(item.workflowPath)) continue
			if (!isDeployRunningStatus(item.status ?? '')) continue
			try {
				const claimed = await deployRunDal.claimStartNotify(String(item.run))
				if (!claimed) continue
				const payload = buildDeployStartMessage({
					runId: String(item.run),
					commit: item.commit ?? '',
					ref: item.ref ?? '',
					actor: item.actor ?? '',
					msg: item.msg,
					repo: resolveRepo(),
				})
				const n = await broadcast(payload)
				console.log(`[deploy-notify] 发布开始 run=${item.run} → ${n} 位管理员`)
			} catch (e) {
				console.error(`[deploy-notify] 发布开始通知失败 run=${item.run}:`, e)
			}
		}
	},

	/**
	 * 失败原因回填后：CDN 部署发「发布失败」（幂等 claim；成功路径不调用）
	 */
	async notifyFail(runId: string): Promise<void> {
		const row = await deployRunDal.findByRunId(runId)
		if (!row) return
		if (!isCdnDeployWorkflow(row.workflowPath)) return
		if (!isDeployFailedStatus(row.status)) return
		try {
			const claimed = await deployRunDal.claimFailNotify(runId)
			if (!claimed) return
			const payload = buildDeployFailMessage({
				runId,
				commit: row.commitSha,
				ref: row.ref,
				actor: row.actor,
				msg: row.msg,
				status: row.status,
				failedJob: row.failureJob,
				failedStep: row.failureStep,
				errorExcerpt: row.failureExcerpt,
				repo: resolveRepo(),
			})
			const n = await broadcast(payload)
			console.log(`[deploy-notify] 发布失败 run=${runId} → ${n} 位管理员`)
		} catch (e) {
			console.error(`[deploy-notify] 发布失败通知失败 run=${runId}:`, e)
		}
	},
}
