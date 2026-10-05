import { describe, expect, it } from 'bun:test'
import { CHAMPIONS } from '../data/set18'
import { type CombatUnitInput, simulateCombat } from './combat'
import { makeRng } from './rng'
import { makePlayer } from './testUtils'
import { applyTraitStats } from './traitEffects'
import { computeActiveTraits } from './traits'
import { createUnit, resetUidSeq, unitStats } from './units'

const buildTeam = (seed: number, size: number): CombatUnitInput[] => {
	resetUidSeq()
	const rng = makeRng(seed)
	const p = makePlayer(9)
	for (let i = 0; i < size; i++) {
		const c = CHAMPIONS[rng.int(CHAMPIONS.length)]
		const u = createUnit(c.apiName, rng.next() < 0.3 ? 2 : 1)
		if (rng.next() < 0.4) u.items = ['TFT_Item_BFSword']
		p.board.push({ ...u, pos: { col: i % 7, row: Math.floor(i / 7) % 4 } })
	}
	const active = computeActiveTraits(p.board)
	return p.board.map((b) => ({
		uid: b.uid,
		apiName: b.apiName,
		star: b.star,
		pos: b.pos,
		stats: applyTraitStats(b, unitStats(b), active),
		items: b.items,
	}))
}

describe('combat', () => {
	it('随机 7v7 收敛：有胜者、无 NaN、血量有界', () => {
		const a = buildTeam(1, 7)
		const b = buildTeam(2, 7)
		const r = simulateCombat(a, b, { rng: makeRng(3), recordEvents: false })
		expect(['A', 'B', 'draw']).toContain(r.winner)
		expect(r.durationMs).toBeGreaterThan(0)
		for (const v of Object.values(r.damageDealt)) {
			expect(Number.isFinite(v)).toBe(true)
			expect(v).toBeGreaterThanOrEqual(0)
		}
	})

	it('同种子完全可复现', () => {
		const a1 = buildTeam(1, 5)
		const b1 = buildTeam(2, 5)
		const r1 = simulateCombat(a1, b1, { rng: makeRng(9), recordEvents: false })
		const a2 = buildTeam(1, 5)
		const b2 = buildTeam(2, 5)
		const r2 = simulateCombat(a2, b2, { rng: makeRng(9), recordEvents: false })
		expect(r1.winner).toBe(r2.winner)
		expect(r1.durationMs).toBe(r2.durationMs)
		expect(r1.damageDealt).toEqual(r2.damageDealt)
	})

	it('强弱悬殊时强方必胜', () => {
		resetUidSeq()
		const weak = buildTeam(1, 2)
		const strongChamp = CHAMPIONS.find((c) => c.cost === 5)
		if (!strongChamp) throw new Error('no 5-cost')
		const strong: CombatUnitInput[] = Array.from({ length: 7 }, (_, i) => {
			const u = createUnit(strongChamp.apiName, 3)
			return {
				uid: u.uid,
				apiName: u.apiName,
				star: u.star,
				pos: { col: i % 7, row: 0 },
				stats: unitStats(u),
				items: [],
			}
		})
		const r = simulateCombat(weak, strong, { rng: makeRng(5), recordEvents: false })
		expect(r.winner).toBe('B')
		expect(r.survivorsB).toBeGreaterThan(0)
	})

	it('事件流包含攻击/伤害/死亡', () => {
		const a = buildTeam(1, 3)
		const b = buildTeam(2, 3)
		const r = simulateCombat(a, b, { rng: makeRng(4) })
		const types = new Set(r.events.map((e) => e.type))
		expect(types.has('attack')).toBe(true)
		expect(types.has('damage')).toBe(true)
		expect(types.has('death')).toBe(true)
		expect(r.events.length).toBeLessThan(20000)
	})
})
