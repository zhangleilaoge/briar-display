import fs from 'fs'
import { fileURLToPath } from 'url'

// 本文件会被 tsup 复制到 src/jobs、dist/jobs、<pkg>/jobs 三个位置，
// 依次尝试相对路径，定位 src/services 下的服务文件
const candidates = [
	new URL('../services/mediaCacheService.ts', import.meta.url),
	new URL('../src/services/mediaCacheService.ts', import.meta.url),
]
const serviceUrl = candidates.find((url) => fs.existsSync(fileURLToPath(url)))
if (!serviceUrl) {
	throw new Error('找不到 mediaCacheService.ts')
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
const { mediaCacheService } = await tsImport(serviceUrl.href, serviceUrl.href)
const { schedulerRunService } = await tsImport(
	schedulerRunServiceUrl.href,
	schedulerRunServiceUrl.href,
)

try {
	await schedulerRunService.runWithLog('cleanup-media-cache', 'scheduled', async () => {
		const deleted = await mediaCacheService.cleanupExpiredMedia()
		return `已清理过期的媒体缓存 ${deleted} 条（含 COS 对象）`
	})
	process.exit(0)
} catch (error) {
	console.error('[cleanup-media-cache] 执行失败:', error)
	process.exit(1)
}
