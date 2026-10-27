import fs from 'fs'
import { fileURLToPath } from 'url'

// 与构建复制出的三个 jobs 目录兼容，始终从源目录加载服务。
const candidates = [
	new URL('../services/market/csi300EtfService.ts', import.meta.url),
	new URL('../src/services/market/csi300EtfService.ts', import.meta.url),
]
const serviceUrl = candidates.find((url) => fs.existsSync(fileURLToPath(url)))
if (!serviceUrl) throw new Error('找不到 csi300EtfService.ts')

const schedulerRunCandidates = [
	new URL('../services/schedulerRunService.ts', import.meta.url),
	new URL('../src/services/schedulerRunService.ts', import.meta.url),
]
const schedulerRunServiceUrl = schedulerRunCandidates.find((url) =>
	fs.existsSync(fileURLToPath(url)),
)
if (!schedulerRunServiceUrl) throw new Error('找不到 schedulerRunService.ts')

const { tsImport } = await import('tsx/esm/api')
const { syncCsi300EtfScale } = await tsImport(serviceUrl.href, serviceUrl.href)
const { schedulerRunService } = await tsImport(
	schedulerRunServiceUrl.href,
	schedulerRunServiceUrl.href,
)

try {
	await schedulerRunService.runWithLog('sync-csi300-etf-scale', 'scheduled', syncCsi300EtfScale)
	process.exit(0)
} catch (error) {
	console.error('[sync-csi300-etf-scale] 执行失败:', error)
	process.exit(1)
}
