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

const { tsImport } = await import('tsx/esm/api')
const { maintenanceService } = await tsImport(
	maintenanceServiceUrl.href,
	maintenanceServiceUrl.href,
)

await maintenanceService.clearAllVerificationCodes()
