import fs from 'fs'
import { fileURLToPath } from 'url'

// 本文件会被 tsup 复制到 src/jobs、dist/jobs、<pkg>/jobs 三个位置，
// 依次尝试相对路径，定位 src/services 下的服务文件
const serviceCandidates = [
	new URL('../services/deploymentService.ts', import.meta.url),
	new URL('../src/services/deploymentService.ts', import.meta.url),
]
const deploymentServiceUrl = serviceCandidates.find((url) => fs.existsSync(fileURLToPath(url)))
if (!deploymentServiceUrl) {
	throw new Error('找不到 deploymentService.ts')
}

const schedulerRunCandidates = [
	new URL('../services/schedulerRunService.ts', import.meta.url),
	new URL('../src/services/schedulerRunService.ts', import.meta.url),
]
const schedulerRunServiceUrl = schedulerRunCandidates.find((url) =>
	fs.existsSync(fileURLToPath(url)),
)
if (!schedulerRunServiceUrl) {
	throw new Error('找不到 schedulerRunService.ts')
}

const { tsImport } = await import('tsx/esm/api')
const { deploymentService } = await tsImport(deploymentServiceUrl.href, deploymentServiceUrl.href)
const { schedulerRunService } = await tsImport(
	schedulerRunServiceUrl.href,
	schedulerRunServiceUrl.href,
)

try {
	await schedulerRunService.runWithLog('sync-deploy-runs', 'scheduled', async () => {
		const items = await deploymentService.listDeployRuns(30, { awaitFailureBackfill: true })
		const running = items.filter((i) =>
			['queued', 'in_progress', 'waiting', 'requested', 'pending'].includes(
				(i.status || '').toLowerCase(),
			),
		).length
		const failed = items.filter((i) =>
			[
				'failure',
				'failed',
				'cancelled',
				'timed_out',
				'startup_failure',
				'action_required',
			].includes((i.status || '').toLowerCase()),
		).length
		return {
			message: `已同步 ${items.length} 条部署记录（进行中 ${running}，失败态 ${failed}）`,
			detail: { total: items.length, running, failed },
		}
	})
	process.exit(0)
} catch (error) {
	console.error('[sync-deploy-runs] 执行失败:', error)
	process.exit(1)
}
