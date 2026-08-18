/**
 * 写入版本指纹到指定路径的 version.json
 *
 * 用法：
 *   bun packages/briar-scripts/scripts/write-version.ts <outputDir|outputFile>
 *
 * 示例：
 *   bun packages/briar-scripts/scripts/write-version.ts packages/briar-display/dist
 *   bun packages/briar-scripts/scripts/write-version.ts packages/briar-node/dist
 *
 * 不传参数时默认写到 packages/briar-display/dist/version.json
 */
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

interface VersionInfo {
	commit: string
	branch: string
	dirty: boolean
	builtAt: string
	builder: string
}

const git = (cmd: string): string => {
	try {
		return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim()
	} catch {
		return 'unknown'
	}
}

const resolveTarget = (arg: string | undefined): string => {
	if (!arg) return path.resolve(process.cwd(), 'packages/briar-display/dist/version.json')
	const abs = path.resolve(process.cwd(), arg)
	return abs.endsWith('.json') ? abs : path.join(abs, 'version.json')
}

const main = () => {
	const target = resolveTarget(process.argv[2])

	const info: VersionInfo = {
		commit: git('rev-parse HEAD'),
		branch: git('rev-parse --abbrev-ref HEAD'),
		// --ignore-submodules=untracked：briar-assets 里的 deploy-history.jsonl 审计记录
		// 是 CI 追加的未跟踪文件，不应让版本指纹永远 dirty
		dirty: git('status --porcelain --ignore-submodules=untracked').length > 0,
		builtAt: new Date().toISOString(),
		builder: process.env.USER || process.env.USERNAME || 'ci',
	}

	fs.mkdirSync(path.dirname(target), { recursive: true })
	fs.writeFileSync(target, `${JSON.stringify(info, null, 2)}\n`)
	console.log(`[write-version] version.json written -> ${target}`)
	console.log(`[write-version] commit=${info.commit} branch=${info.branch} dirty=${info.dirty}`)
}

main()
