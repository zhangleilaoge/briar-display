// 删除 ssh2 及其可选依赖的原生绑定（sshcrypto.node / cpufeatures.node）
// 背景：这两个 NAPI 模块在 bun install 时编译，但加载即崩溃（bun: panic unsupported uv
// function；node: segfault），进程直接 core dump。ssh2 对两者都有纯 JS 降级，删掉即可。
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const candidates = [
	'node_modules/ssh2/lib/protocol/crypto/build',
	'node_modules/cpu-features/build',
]

// bun 的隔离安装布局：node_modules/.bun/<pkg>@x.y.z/node_modules/<pkg>/...
const bunStore = 'node_modules/.bun'
if (existsSync(bunStore)) {
	for (const entry of readdirSync(bunStore)) {
		if (entry.startsWith('ssh2@')) {
			candidates.push(join(bunStore, entry, 'node_modules/ssh2/lib/protocol/crypto/build'))
		}
		if (entry.startsWith('cpu-features@')) {
			candidates.push(join(bunStore, entry, 'node_modules/cpu-features/build'))
		}
	}
}

let removed = 0
for (const dir of candidates) {
	if (existsSync(dir)) {
		rmSync(dir, { recursive: true, force: true })
		removed++
		console.log(`✅ 已删除原生绑定: ${dir}`)
	}
}
if (removed === 0) {
	console.log('ℹ️  未发现 ssh2/cpu-features 原生绑定，跳过')
}
