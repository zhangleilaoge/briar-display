import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

/**
 * 启动时显式加载仓库根目录 .env。
 * PM2 不会把 shell 环境注入已注册的应用（restart 沿用首次启动捕获的环境），
 * `dotenv/config` 默认按 cwd 找 .env 也会落空（PM2 cwd 是 packages/briar-node）。
 * 注意构建后所有代码打进 dist/index.js：dist 向上三级是仓库根，src/lib 向上四级才是，两个都试。
 */
const here = path.dirname(fileURLToPath(import.meta.url))
for (const rel of ['../../../.env', '../../../../.env']) {
	const candidate = path.resolve(here, rel)
	if (fs.existsSync(candidate)) {
		dotenv.config({ path: candidate })
		break
	}
}
