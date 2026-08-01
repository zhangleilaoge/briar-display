import { HTTP_STATUS, PERMISSIONS } from '@briar/shared'
import { Hono } from 'hono'
import { requirePermission } from '../middleware/permissionMiddleware'
import { deploymentService } from '../services/deploymentService'

const deploymentRoutes = new Hono()

/**
 * 部署记录（读取服务器上 CI 写入的 deploy-history.jsonl）
 */
deploymentRoutes.get('/history', requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE), async (c) => {
	const items = await deploymentService.listDeployHistory(50)
	return c.json({
		success: true,
		data: { items },
		code: HTTP_STATUS.OK,
	})
})

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

export default deploymentRoutes
