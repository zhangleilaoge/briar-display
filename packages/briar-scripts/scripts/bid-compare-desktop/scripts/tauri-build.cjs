#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { displayVersion, nextBuildVersions, syncVersions } = require('./version.cjs')

const DESKTOP_DIR = path.resolve(__dirname, '..')
const TARGET = process.argv[2] || 'current'
const LABEL = process.argv[3] || TARGET

function now() {
	const d = new Date()
	return d.toTimeString().slice(0, 8)
}

function renameBundles(version, display) {
	const targetDir =
		TARGET === 'current'
			? path.join(DESKTOP_DIR, 'src-tauri/target/release')
			: path.join(DESKTOP_DIR, `src-tauri/target/${TARGET}/release`)
	for (const kind of ['dmg', 'msi', 'nsis']) {
		const dir = path.join(targetDir, 'bundle', kind)
		if (!fs.existsSync(dir)) continue
		for (const name of fs.readdirSync(dir)) {
			if (!name.includes(version)) continue
			const nextName = name.replaceAll(version, display)
			fs.renameSync(path.join(dir, name), path.join(dir, nextName))
			console.log(`安装包: ${path.join(dir, nextName)}`)
		}
	}
}

async function main() {
	const pkg = JSON.parse(fs.readFileSync(path.join(DESKTOP_DIR, 'package.json'), 'utf8'))
	const previousDisplay = pkg.displayVersion || displayVersion(pkg.version)
	const { internal, display } = nextBuildVersions()
	console.log(`更新日期版本: ${previousDisplay} -> ${display}`)
	console.log(`安装器内部版本: ${internal}`)
	for (const file of syncVersions(internal, display)) console.log(`  - ${file}`)

	console.log('')
	console.log(`[${now()}] 开始: Tauri 构建 (${LABEL})`)
	const start = Date.now()
	const args = ['tauri', 'build']
	if (TARGET !== 'current') args.push('--target', TARGET)

	await new Promise((resolve, reject) => {
		const child = spawn('npx', args, {
			cwd: DESKTOP_DIR,
			stdio: 'inherit',
			shell: true,
			env: { ...process.env, BRIAR_DISPLAY_VERSION: display.replace(/^v/, '') },
		})
		child.on('error', reject)
		child.on('close', (code) => {
			if (code === 0) resolve()
			else reject(new Error(`Tauri build exited with code ${code}`))
		})
	})

	renameBundles(internal, display)
	const elapsed = Math.round((Date.now() - start) / 1000)
	console.log(`[${now()}] 结束: Tauri 构建 (${LABEL}) (耗时 ${elapsed}s)`)
}

main().catch((err) => {
	console.error(err.message)
	process.exit(1)
})
