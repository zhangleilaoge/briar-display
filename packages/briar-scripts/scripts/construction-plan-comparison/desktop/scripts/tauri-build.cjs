#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const readline = require('readline')

const DESKTOP_DIR = path.resolve(__dirname, '..')
const TARGET = process.argv[2] || 'current'
const LABEL = process.argv[3] || TARGET

function now() {
	const d = new Date()
	return d.toTimeString().slice(0, 8)
}

function bumpVersion(version, kind) {
	const [maj, min, pat] = version.split('.').map(Number)
	switch (kind) {
		case 'major':
			return `${maj + 1}.0.0`
		case 'minor':
			return `${maj}.${min + 1}.0`
		case 'patch':
			return `${maj}.${min}.${pat + 1}`
		default:
			throw new Error(`unknown bump kind: ${kind}`)
	}
}

function setVersion(file, pattern, replacement) {
	const p = path.join(DESKTOP_DIR, file)
	const content = fs.readFileSync(p, 'utf8')
	const next = content.replace(pattern, replacement)
	if (next !== content) {
		fs.writeFileSync(p, next)
		console.log(`  - ${file}`)
	}
}

async function promptBump() {
	const envBump = process.env.BUMP
	if (envBump) {
		return envBump === 'none' || envBump === 'no' ? '' : envBump
	}
	if (!process.stdin.isTTY) {
		return 'patch'
	}
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
	const choice = await new Promise((resolve) => {
		rl.question(
			'\n请选择版本升级方式（默认: patch）：\n' +
				'  1) patch  小版本+1 [默认]\n' +
				'  2) minor  中版本+1\n' +
				'  3) major  大版本+1\n' +
				'  4) 不升级\n' +
				'输入选项 [1]: ',
			(answer) => resolve(answer.trim()),
		)
	})
	rl.close()
	switch (choice || '1') {
		case '1':
		case 'patch':
		case '':
			return 'patch'
		case '2':
		case 'minor':
			return 'minor'
		case '3':
		case 'major':
			return 'major'
		case '4':
		case 'none':
		case 'no':
			return ''
		default:
			throw new Error(`无效选项: ${choice}`)
	}
}

async function main() {
	const bumpKind = await promptBump()
	if (bumpKind) {
		const pkgPath = path.join(DESKTOP_DIR, 'package.json')
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
		const current = pkg.version
		const next = bumpVersion(current, bumpKind)
		console.log(`更新版本: ${current} -> ${next}`)
		console.log('已同步更新:')
		const replacement = (v) => v.replace(/"version":\s*"[^"]+"/, `"version": "${next}"`)
		const cargoReplacement = (v) => v.replace(/^version = "[^"]+"/m, `version = "${next}"`)
		setVersion('package.json', /"version":\s*"[^"]+"/, `"version": "${next}"`)
		setVersion('src-tauri/tauri.conf.json', /"version":\s*"[^"]+"/, `"version": "${next}"`)
		setVersion('src-tauri/Cargo.toml', /^version = "[^"]+"/m, `version = "${next}"`)
	}

	console.log('')
	console.log(`[${now()}] 开始: Tauri 构建 (${LABEL})`)
	const start = Date.now()

	const args = ['tauri', 'build']
	if (TARGET !== 'current') {
		args.push('--target', TARGET)
	}

	await new Promise((resolve, reject) => {
		const child = spawn('npx', args, {
			cwd: DESKTOP_DIR,
			stdio: 'inherit',
			shell: true,
		})
		child.on('error', reject)
		child.on('close', (code) => {
			if (code === 0) resolve()
			else reject(new Error(`Tauri build exited with code ${code}`))
		})
	})

	const elapsed = Math.round((Date.now() - start) / 1000)
	console.log(`[${now()}] 结束: Tauri 构建 (${LABEL}) (耗时 ${elapsed}s)`)
}

main().catch((err) => {
	console.error(err.message)
	process.exit(1)
})
