import { HTTP_STATUS, PERMISSIONS } from '@briar/shared'
import { Hono } from 'hono'
import { deployRunDal } from '../dal/deployRunDal'
import { RUN_STATS_WINDOW, buildStats, parseHistoryQuery } from '../lib/runHistory'
import { requirePermission } from '../middleware/permissionMiddleware'
import { deploymentService } from '../services/deploymentService'

const deploymentRoutes = new Hono()

/**
 * 部署记录（读取服务器上 CI 写入的 deploy-history.jsonl）
 */
deploymentRoutes.get('/history', requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE), async (c) => {
	const items = await deploymentService.listDeployRuns(20)
	return c.json({
		success: true,
		data: { items },
		code: HTTP_STATUS.OK,
	})
})

/**
 * 已落库的部署历史（通用 RunRecord 格式，分页 + 状态筛选）
 * 读取前先同步一次最新 runs 入库（失败忽略，直接读库）
 */
deploymentRoutes.get(
	'/history/runs',
	requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE),
	async (c) => {
		const opts = parseHistoryQuery((k) => c.req.query(k))
		if (opts.offset === 0) {
			await deploymentService.listDeployRuns(50).catch(() => [])
		}
		const [page, recent] = await Promise.all([
			deployRunDal.listPaged(opts),
			deployRunDal.recentStatuses(RUN_STATS_WINDOW),
		])
		return c.json({
			success: true,
			data: { ...page, stats: buildStats(recent) },
			code: HTTP_STATUS.OK,
		})
	},
)

/**
 * 某次部署（GitHub Actions run）的完整日志
 */
deploymentRoutes.get(
	'/:runId/logs',
	requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE),
	async (c) => {
		try {
			const logs = await deploymentService.getRunLogs(c.req.param('runId'))
			return c.json({
				success: true,
				data: logs,
				code: HTTP_STATUS.OK,
			})
		} catch (error) {
			return c.json(
				{
					success: false,
					message: error instanceof Error ? error.message : String(error),
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}
	},
)

/**
 * 某次部署的步骤级实时进度（运行中即可用，解决日志接口进行中 404 的问题）
 */
deploymentRoutes.get(
	'/:runId/progress',
	requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE),
	async (c) => {
		try {
			const progress = await deploymentService.getRunProgress(c.req.param('runId'))
			return c.json({
				success: true,
				data: progress,
				code: HTTP_STATUS.OK,
			})
		} catch (error) {
			return c.json(
				{
					success: false,
					message: error instanceof Error ? error.message : String(error),
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}
	},
)

/**
 * 服务器端 deploy.sh 的行级实时进度（读服务器本地进度文件）
 */
deploymentRoutes.get('/live', requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE), async (c) => {
	return c.json({
		success: true,
		data: deploymentService.getLiveProgress(),
		code: HTTP_STATUS.OK,
	})
})

/**
 * 触发远程 Nginx 配置部署
 */

/**
 * 重试某次 GitHub Actions 部署 run（卡住先 cancel 再 rerun）
 */
deploymentRoutes.post(
	'/:runId/rerun',
	requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE),
	async (c) => {
		try {
			const result = await deploymentService.rerunDeployRun(c.req.param('runId'))
			return c.json({
				success: true,
				data: result,
				code: HTTP_STATUS.OK,
			})
		} catch (error) {
			return c.json(
				{
					success: false,
					message: error instanceof Error ? error.message : String(error),
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}
	},
)

deploymentRoutes.post(
	'/nginx/deploy',
	requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE),
	async (c) => {
		try {
			const result = await deploymentService.triggerNginxDeploy()
			return c.json({
				success: true,
				data: result,
				code: HTTP_STATUS.OK,
			})
		} catch (error) {
			return c.json(
				{
					success: false,
					message: error instanceof Error ? error.message : String(error),
					code: HTTP_STATUS.BAD_REQUEST,
				},
				HTTP_STATUS.BAD_REQUEST,
			)
		}
	},
)

export default deploymentRoutes
