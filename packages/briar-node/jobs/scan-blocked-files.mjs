import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// 加载 .env 文件（数据库与 COS 配置）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function findRepoRoot(startDir) {
	let currentDir = startDir
	while (true) {
		if (fs.existsSync(path.join(currentDir, 'bun.lock'))) {
			return currentDir
		}
		const parentDir = path.dirname(currentDir)
		if (parentDir === currentDir) {
			return startDir
		}
		currentDir = parentDir
	}
}

const repoRoot = findRepoRoot(__dirname)
const envPath = path.join(repoRoot, '.env')
const result = dotenv.config({ path: envPath })
if (result.error) {
	console.warn(`⚠️  未能加载 .env 文件: ${result.error.message}`)
}

// 本文件会被 tsup 复制到 src/jobs、dist/jobs、<pkg>/jobs 三个位置，
// 依次尝试相对路径，定位 src/services 下的服务文件
const serviceCandidates = [
	new URL('../services/fileModerationService.ts', import.meta.url),
	new URL('../src/services/fileModerationService.ts', import.meta.url),
]
const fileModerationServiceUrl = serviceCandidates.find((url) => fs.existsSync(fileURLToPath(url)))
if (!fileModerationServiceUrl) {
	throw new Error('找不到 fileModerationService.ts')
}

const { tsImport } = await import('tsx/esm/api')
const { fileModerationService } = await tsImport(
	fileModerationServiceUrl.href,
	fileModerationServiceUrl.href,
)

try {
	await fileModerationService.scanAndCleanBlockedImages()
} finally {
	await fileModerationService.close()
}
