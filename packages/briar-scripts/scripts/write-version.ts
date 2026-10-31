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
	sourceCommit: string
	branch: string
	dirty: boolean
	builtAt: string
	builder: string
}

// 与 .github/workflows/deploy.yml 的 push.paths 保持一致。
const DEPLOY_PATHS = [
	'packages/briar-node',
	'packages/briar-display',
	'packages/briar-shared',
	'packages/briar-scripts',
	'scripts/deploy.sh',
	'package.json',
	'bun.lock',
	'Makefile',
	'biome.json',
	'.github/workflows/deploy.yml',
]

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
	const commit = git('rev-parse HEAD')
	const sourceCommit = git(`log -1 --format=%H -- ${DEPLOY_PATHS.join(' ')}`)

	const info: VersionInfo = {
		commit,
		sourceCommit: sourceCommit === 'unknown' || !sourceCommit ? commit : sourceCommit,
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
	console.log(
		`[write-version] commit=${info.commit} sourceCommit=${info.sourceCommit} branch=${info.branch} dirty=${info.dirty}`,
	)
}

main()
