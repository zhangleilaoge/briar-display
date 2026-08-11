import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// 加载 .env 文件
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

// 先加载 .env 文件
const result = dotenv.config({ path: envPath })
console.log(`📁 加载 .env 文件: ${envPath}`)
if (result.error) {
	console.warn(`⚠️  未能加载 .env 文件: ${result.error.message}`)
} else {
	console.log(`✅ 已加载 ${Object.keys(result.parsed || {}).length} 个环境变量`)
	if (!process.env.ACME_EMAIL) {
		console.warn('⚠️  警告: .env 文件中未找到 ACME_EMAIL')
	}
}

// 本文件会被 tsup 复制到 src/jobs、dist/jobs、<pkg>/jobs 三个位置，
// 依次尝试相对路径，定位 src/services 下的服务文件
const serviceCandidates = [
	new URL('../services/certificateService.ts', import.meta.url),
	new URL('../src/services/certificateService.ts', import.meta.url),
]
const certificateServiceUrl = serviceCandidates.find((url) => fs.existsSync(fileURLToPath(url)))
if (!certificateServiceUrl) {
	throw new Error('找不到 certificateService.ts')
}

const { tsImport } = await import('tsx/esm/api')
const { certificateService } = await tsImport(
	certificateServiceUrl.href,
	certificateServiceUrl.href,
)

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
const { schedulerRunService } = await tsImport(
	schedulerRunServiceUrl.href,
	schedulerRunServiceUrl.href,
)

const domain = process.env.CERTIFICATE_DOMAIN || 'xiaobuzi.cn'

try {
	await schedulerRunService.runWithLog('renew-certificates', 'scheduled', async () => {
		const result = await certificateService.renewCertificate(domain, false, 'scheduled')
		if (!result.success) throw new Error(result.error || '续期失败')
		return result.skipped ? '证书尚未到期，已跳过' : '证书续期成功'
	})
	process.exit(0)
} catch (error) {
	console.error('[renew-certificates] 执行失败:', error)
	process.exit(1)
}
