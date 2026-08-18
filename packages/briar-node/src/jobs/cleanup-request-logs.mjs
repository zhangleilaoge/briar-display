import fs from 'fs'
import { fileURLToPath } from 'url'

// 本文件会被 tsup 复制到 src/jobs、dist/jobs、<pkg>/jobs 三个位置，
// 依次尝试相对路径，定位 src/dal 下的数据访问文件
const dalCandidates = [
	new URL('../dal/logDal.ts', import.meta.url),
	new URL('../src/dal/logDal.ts', import.meta.url),
]
const logDalUrl = dalCandidates.find((url) => fs.existsSync(fileURLToPath(url)))
if (!logDalUrl) {
	throw new Error('找不到 logDal.ts')
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
const { logDal } = await tsImport(logDalUrl.href, logDalUrl.href)
const { schedulerRunService } = await tsImport(
	schedulerRunServiceUrl.href,
	schedulerRunServiceUrl.href,
)

const RETENTION_DAYS = 90

try {
	await schedulerRunService.runWithLog('cleanup-request-logs', 'scheduled', async () => {
		const deleted = await logDal.cleanup(RETENTION_DAYS)
		return `已清理 ${RETENTION_DAYS} 天前的请求日志 ${deleted} 条`
	})
	process.exit(0)
} catch (error) {
	console.error('[cleanup-request-logs] 执行失败:', error)
	process.exit(1)
}
