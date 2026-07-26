const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

function findBash() {
	if (process.platform !== 'win32') {
		return 'bash'
	}

	// 1. 允许通过环境变量指定 Git Bash
	if (process.env.GIT_BASH && fs.existsSync(process.env.GIT_BASH)) {
		return process.env.GIT_BASH
	}

	// 2. 常见 Git for Windows 安装路径
	const candidates = [
		'C:\\Program Files\\Git\\bin\\bash.exe',
		'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
		'D:\\app\\Git\\bin\\bash.exe',
	]

	for (const c of candidates) {
		if (fs.existsSync(c)) return c
	}

	// 3. 根据 git.exe 位置推导 bash 路径
	try {
		const gitResult = spawnSync('where', ['git'], { encoding: 'utf8', shell: true })
		if (gitResult.status === 0) {
			const gitPath = gitResult.stdout.trim().split('\n')[0].trim()
			const gitRoot = path.resolve(gitPath, '..', '..')
			const bashFromGit = path.join(gitRoot, 'bin', 'bash.exe')
			if (fs.existsSync(bashFromGit)) return bashFromGit
		}
	} catch {
		// ignore
	}

	// 4. 兜底，交给系统解析
	return 'bash'
}

const script = process.argv[2]
const args = process.argv.slice(3)

if (!script) {
	console.error('用法: node run-sh.cjs <shell-script> [args...]')
	process.exit(1)
}

const bash = findBash()
const scriptPath = path.resolve(__dirname, '..', script)

const result = spawnSync(bash, [scriptPath, ...args], {
	stdio: 'inherit',
	shell: false,
})

process.exit(result.status ?? 0)
