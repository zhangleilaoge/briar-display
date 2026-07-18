import fs from 'fs'
import path from 'path'
import type { ApiResponse } from '@briar/shared'
import { Hono } from 'hono'

const versionRoutes = new Hono()

const startedAt = new Date().toISOString()

// 锚点：pm2 cwd 固定为 packages/briar-node（见 ecosystem.config.cjs），dev 模式同理
const NODE_ROOT = process.cwd()
const BACKEND_VERSION = path.resolve(NODE_ROOT, 'dist/version.json')

// 前端静态目录：与 index.ts 保持一致（生产优先 web/，fallback dist/）
const isDev = process.env.NODE_ENV !== 'production'
const WEB_PATH = path.resolve(NODE_ROOT, '../briar-display/web')
const DIST_PATH = path.resolve(NODE_ROOT, '../briar-display/dist')
const FRONTEND_STATIC = isDev ? DIST_PATH : fs.existsSync(WEB_PATH) ? WEB_PATH : DIST_PATH

const readJson = (p: string): Record<string, unknown> | null => {
	try {
		if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>
	} catch {
		// 损坏的 version.json 忽略
	}
	return null
}

/** GET /api/version — 返回前后端版本指纹，用于一致性校验 */
versionRoutes.get('/', (c) => {
	const backend = readJson(BACKEND_VERSION)
	const frontend = readJson(path.join(FRONTEND_STATIC, 'version.json'))

	return c.json<ApiResponse>({
		success: true,
		data: {
			backend,
			frontend,
			startedAt,
		},
	})
})

export default versionRoutes
