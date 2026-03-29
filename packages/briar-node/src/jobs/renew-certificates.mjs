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
		if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
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

const certificateServiceUrl = new URL('../services/certificateService.ts', import.meta.url).href

const { tsImport } = await import('tsx/esm/api')
const { certificateService } = await tsImport(certificateServiceUrl, certificateServiceUrl)

const domain = process.env.CERTIFICATE_DOMAIN || 'stardew.site'

await certificateService.renewCertificate(domain)
