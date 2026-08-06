import { HTTP_STATUS, PERMISSIONS } from '@briar/shared'
import { Hono } from 'hono'
import { schedulerRunDal } from '../dal/schedulerRunDal'
import { schedulerTasks } from '../lib/schedulerConfig'
import { requirePermission } from '../middleware/permissionMiddleware'
import { schedulerRunService } from '../services/schedulerRunService'

const schedulerRoutes = new Hono()

/** GET /tasks — 任务列表 + 最近一次运行记录 */
schedulerRoutes.get('/tasks', requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE), async (c) => {
	const latest = await schedulerRunDal.latestByTask()
	const items = schedulerTasks
		.filter((task) => task.enabled !== false)
		.map((task) => ({
			name: task.name,
			label: task.label ?? task.name,
			description: task.description ?? '',
			scheduleText: task.scheduleText ?? task.cron ?? '',
			manual: typeof task.run === 'function',
			lastRun: latest.get(task.name) ?? null,
		}))

	return c.json({ success: true, data: { items }, code: HTTP_STATUS.OK })
})

/** POST /tasks/:name/run — 手动触发（异步执行，结果写 scheduler_runs） */
schedulerRoutes.post(
	'/tasks/:name/run',
	requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE),
	async (c) => {
		const task = schedulerTasks.find((t) => t.name === c.req.param('name') && t.enabled !== false)
		if (!task?.run) {
			return c.json(
				{ success: false, message: '任务不存在或不支持手动触发', code: HTTP_STATUS.NOT_FOUND },
				HTTP_STATUS.NOT_FOUND,
			)
		}

		const latest = (await schedulerRunDal.latestByTask()).get(task.name)
		if (latest?.status === 'running') {
			return c.json(
				{ success: false, message: '任务正在执行中', code: HTTP_STATUS.CONFLICT },
				HTTP_STATUS.CONFLICT,
			)
		}

		// 异步执行，避免耗时任务（如证书续期）撑爆 HTTP 超时；结果在运行记录中查看
		void schedulerRunService
			.runWithLog(task.name, 'manual', task.run)
			.catch((err) => console.error(`[Scheduler] 手动触发 ${task.name} 失败:`, err))

		return c.json({ success: true, message: '任务已启动', code: HTTP_STATUS.OK })
	},
)

export default schedulerRoutes
