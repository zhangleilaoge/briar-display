const fs = require('fs')
const path = require('path')

const DESKTOP_DIR = path.resolve(__dirname, '..')

function readPackage() {
	return JSON.parse(fs.readFileSync(path.join(DESKTOP_DIR, 'package.json'), 'utf8'))
}

function displayVersion(version) {
	const match = /^v?(\d{8})\.0\.(\d+)$/.exec(version)
	if (match) return `v${match[1]}.${match[2]}`
	return version.startsWith('v') ? version : `v${version}`
}

function nextDateVersion(version, date = new Date()) {
	const day = [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, '0'),
		String(date.getDate()).padStart(2, '0'),
	].join('')
	const match = /^v?(\d{8})\.(?:0\.)?(\d+)$/.exec(version)
	const sequence = match?.[1] === day ? Number(match[2]) + 1 : 1
	return `v${day}.${sequence}`
}

function nextInternalVersion(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
	if (!match) throw new Error(`内部版本格式无效: ${version}`)
	return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

function nextBuildVersions(date = new Date()) {
	const pkg = readPackage()
	return {
		internal: nextInternalVersion(pkg.version),
		display: nextDateVersion(pkg.displayVersion || displayVersion(pkg.version), date),
	}
}

function updateFile(file, pattern, version) {
	const filePath = path.join(DESKTOP_DIR, file)
	const content = fs.readFileSync(filePath, 'utf8')
	if (!pattern.test(content)) throw new Error(`版本字段匹配失败: ${file}`)
	const next = content.replace(pattern, `$1${version}$2`)
	if (next === content) return false
	fs.writeFileSync(filePath, next)
	return true
}

function updatePackageJson(internal, display) {
	const file = 'package.json'
	const filePath = path.join(DESKTOP_DIR, file)
	const content = fs.readFileSync(filePath, 'utf8')
	let next = content.replace(/("version"\s*:\s*")[^"]+(")/, `$1${internal}$2`)
	if (/"displayVersion"\s*:/.test(next)) {
		next = next.replace(/("displayVersion"\s*:\s*")[^"]+(")/, `$1${display}$2`)
	} else {
		next = next.replace(/("version"\s*:\s*"[^"]+")/, `$1,\n\t"displayVersion": "${display}"`)
	}
	if (next === content) return false
	fs.writeFileSync(filePath, next)
	return true
}

function syncVersions(internal, display) {
	const changed = []
	if (updatePackageJson(internal, display)) changed.push('package.json')
	if (updateFile('src-tauri/tauri.conf.json', /("version"\s*:\s*")[^"]+(")/, internal)) {
		changed.push('src-tauri/tauri.conf.json')
	}
	if (updateFile('src-tauri/Cargo.toml', /^(version\s*=\s*")[^"]+(")/m, internal)) {
		changed.push('src-tauri/Cargo.toml')
	}
	if (
		updateFile(
			'src-tauri/Cargo.lock',
			/(name = "bid-compare-desktop"\s+version = ")[^"]+(")/,
			internal,
		)
	) {
		changed.push('src-tauri/Cargo.lock')
	}
	if (fs.existsSync(path.join(DESKTOP_DIR, 'package-lock.json'))) {
		const rootChanged = updateFile(
			'package-lock.json',
			/(\s*"name"\s*:\s*"bid-compare-desktop"\s*,\s*"version"\s*:\s*")[^"]+(")\r?/,
			internal,
		)
		const packageChanged = updateFile(
			'package-lock.json',
			/(""\s*:\s*\{\s*"name"\s*:\s*"bid-compare-desktop"\s*,\s*"version"\s*:\s*")[^"]+(")\r?/,
			internal,
		)
		if (rootChanged || packageChanged) changed.push('package-lock.json')
	}
	return changed
}

if (require.main === module) {
	const [command, internal, display] = process.argv.slice(2)
	if (command === 'next') {
		console.log(nextBuildVersions().display)
	} else if (command === 'display') {
		console.log(displayVersion(internal || readPackage().displayVersion || readPackage().version))
	} else if (command === 'sync') {
		const next =
			internal && display ? { internal, display: displayVersion(display) } : nextBuildVersions()
		const changed = syncVersions(next.internal, next.display)
		console.log(`${next.display} (${next.internal})`)
		for (const file of changed) console.log(`已更新: ${file}`)
	} else {
		console.error('用法: node version.cjs <next|display|sync> [internal] [display]')
		process.exit(1)
	}
}

module.exports = {
	displayVersion,
	nextBuildVersions,
	nextDateVersion,
	nextInternalVersion,
	syncVersions,
}
