// headless 压测：8 bot（玩家位不操作）自跑整场，验证引擎收敛
// 用法：bun run packages/briar-display/src/components/tft/engine/headless.ts [场数]
import { GameEngine } from './gameLoop'

const games = Number(process.argv[2] ?? 50)
const endings: string[] = []
let maxTicks = 0
let totalTicks = 0
const t0 = performance.now()

for (let i = 0; i < games; i++) {
	const g = new GameEngine(1000 + i)
	let ticks = 0
	const cap = 300_000
	while (g.state.phase !== 'ended' && ticks < cap) {
		g.tick(100)
		ticks++
	}
	if (g.state.phase !== 'ended') {
		throw new Error(
			`game ${i} 未在 ${cap} ticks 内结束（停在 ${g.state.stage}-${g.state.round} ${g.state.phase}）`,
		)
	}
	const placements = g.state.players.map((p) => p.placement).sort((a, b) => a - b)
	for (let k = 0; k < 8; k++) {
		if (placements[k] !== k + 1) {
			throw new Error(`game ${i} 名次异常: ${placements.join(',')}`)
		}
	}
	for (const p of g.state.players) {
		if (!Number.isFinite(p.gold) || !Number.isFinite(p.hp)) {
			throw new Error(`game ${i} 玩家 ${p.id} 数值 NaN`)
		}
	}
	endings.push(`${g.state.stage}-${g.state.round}`)
	totalTicks += ticks
	maxTicks = Math.max(maxTicks, ticks)
}

const ms = Math.round(performance.now() - t0)
console.log(
	`✅ ${games} 场全部正常结束 | 平均 ${Math.round(totalTicks / games)} ticks | 最大 ${maxTicks} ticks | 耗时 ${ms}ms`,
)
console.log(`终局回合分布: ${[...new Set(endings)].sort().join(' ')}`)
