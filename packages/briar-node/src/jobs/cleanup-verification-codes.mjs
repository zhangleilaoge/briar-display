import fs from 'fs'
import { fileURLToPath } from 'url'

// 本文件会被 tsup 复制到 src/jobs、dist/jobs、<pkg>/jobs 三个位置，
// 依次尝试相对路径，定位 src/services 下的服务文件
const serviceCandidates = [
	new URL('../services/maintenanceService.ts', import.meta.url),
	new URL('../src/services/maintenanceService.ts', import.meta.url),
]
const maintenanceServiceUrl = serviceCandidates.find((url) => fs.existsSync(fileURLToPath(url)))
if (!maintenanceServiceUrl) {
	throw new Error('找不到 maintenanceService.ts')
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
const { maintenanceService } = await tsImport(
	maintenanceServiceUrl.href,
	maintenanceServiceUrl.href,
)
const { schedulerRunService } = await tsImport(
	schedulerRunServiceUrl.href,
	schedulerRunServiceUrl.href,
)

try {
	await schedulerRunService.runWithLog('cleanup-verification-codes', 'scheduled', async () => {
		await maintenanceService.clearAllVerificationCodes()
		return '验证码记录已清理'
	})
	process.exit(0)
} catch (error) {
	console.error('[cleanup-verification-codes] 执行失败:', error)
	process.exit(1)
}
