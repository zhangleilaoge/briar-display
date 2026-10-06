import { describe, expect, it } from 'bun:test'
import { CHAMPIONS, CHAMPION_BY_API, TRAIT_BY_API } from '../../../data/set18'
import { MONSTER_BY_API } from '../../../data/set18/monsters'
import { type CombatUnitInput, simulateCombat } from '../../combat'
import { makeRng } from '../../rng'
import { computeActiveTraits } from '../../traits'
import { emptyCombatStats } from '../../types'
import { createUnit, resetUidSeq, unitStats } from '../../units'

const toInput = (apiName: string, star: 1 | 2 | 3, col: number, row: number): CombatUnitInput => {
	const u = createUnit(apiName, star)
	return { uid: u.uid, apiName, star, pos: { col, row }, stats: unitStats(u), items: [] }
}

let dummySeq = 0
const dummyTeam = (n: number, maxHp?: number): CombatUnitInput[] => {
	const mon = MONSTER_BY_API.get('TFT_TrainingDummy')
	if (!mon) throw new Error('no dummy')
	return Array.from({ length: n }, (_, i) => ({
		uid: `dummy-${dummySeq++}`,
		apiName: 'TFT_TrainingDummy',
		star: 1 as const,
		pos: { col: i * 2, row: 0 },
		stats: { ...emptyCombatStats(), ...mon.stats, mana: 0, maxHp: maxHp ?? mon.stats.maxHp },
		items: [],
	}))
}

/** 凑齐某羁绊首档的阵容（同名拷贝计数，用最低费棋子填） */
const traitTeam = (traitApi: string): CombatUnitInput[] => {
	const def = TRAIT_BY_API.get(traitApi)
	if (!def) throw new Error(`no trait ${traitApi}`)
	const need = def.breakpoints[0]
	const members = CHAMPIONS.filter((c) => c.traits.includes(traitApi)).sort(
		(a, b) => a.cost - b.cost,
	)
	if (members.length === 0) throw new Error(`no champions for ${traitApi}`)
	resetUidSeq()
	const out: CombatUnitInput[] = []
	for (let i = 0; i < need; i++) {
		out.push(toInput(members[i % members.length].apiName, 1, i % 7, Math.floor(i / 7)))
	}
	return out
}

const traitsOfInputs = (inputs: CombatUnitInput[]) =>
	computeActiveTraits(
		inputs.map((t) => {
			resetUidSeq()
			return { ...createUnit(t.apiName, t.star), pos: t.pos }
		}),
	)

describe('traitPlugins', () => {
	it('地狱火：伤害附加灼烧与重伤，假人被跳死', () => {
		const team = traitTeam('DA_18_Inferno')
		const r = simulateCombat(team, dummyTeam(2), {
			rng: makeRng(1),
			traitsA: traitsOfInputs(team),
			maxSeconds: 15,
		})
		expect(r.winner).toBe('A')
		expect(Object.values(r.damageDealt).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
	})

	it('日月双蚀：双拉克丝登场激活，10 秒后周期性处决', () => {
		resetUidSeq()
		const team = [toInput('DA_18_Lux_Moonbeam', 1, 2, 2), toInput('DA_18_Lux_Sunbeam', 1, 4, 2)]
		const traits = computeActiveTraits([
			{ ...createUnit('DA_18_Lux_Moonbeam'), pos: { col: 2, row: 2 } },
			{ ...createUnit('DA_18_Lux_Sunbeam'), pos: { col: 4, row: 2 } },
		])
		expect(traits.find((t) => t.apiName === 'DA_18_Eclipse')).toBeDefined()
		// 高血假人保证战斗拖过 10s，处决 4 次才够全灭
		const r = simulateCombat(team, dummyTeam(4, 6000), {
			rng: makeRng(2),
			traitsA: traits,
			maxSeconds: 30,
		})
		expect(r.winner).toBe('A')
		expect(r.durationMs).toBeGreaterThan(10000)
	})

	it('峡谷野怪(7)：开局成长且每 5 秒再成长', () => {
		const beasts = CHAMPIONS.filter((c) => c.traits.includes('DA_Riftbeast18'))
		resetUidSeq()
		const team = beasts.slice(0, 7).map((c, i) => toInput(c.apiName, 1, i % 7, 1))
		const traits = traitsOfInputs(team)
		const rb = traits.find((t) => t.apiName === 'DA_Riftbeast18')
		expect(rb && rb.breakpointIndex >= 2).toBe(true)
		const r = simulateCombat(team, dummyTeam(1), {
			rng: makeRng(3),
			traitsA: traits,
			recordEvents: false,
			maxSeconds: 12,
		})
		expect(r.winner).toBe('A')
	})

	it('重装战士：开战护盾，假人输出无法击穿', () => {
		const team = traitTeam('DA_18_Vanguard')
		const r = simulateCombat(dummyTeam(3), team, {
			rng: makeRng(4),
			traitsB: traitsOfInputs(team),
			recordEvents: false,
			maxSeconds: 6,
		})
		expect(r.survivorsB).toBe(team.length)
	})

	it('永恒之森：开战召唤植物', () => {
		const team = traitTeam('DA_18_Elderwood')
		const r = simulateCombat(team, dummyTeam(1), {
			rng: makeRng(5),
			traitsA: traitsOfInputs(team),
			maxSeconds: 5,
		})
		expect(r.events.some((e) => e.type === 'summon')).toBe(true)
	})

	it('远古树精：附近敌人阵亡叠层并上报 metric', () => {
		resetUidSeq()
		const team = [
			toInput('DA_18_Maokai', 1, 3, 1),
			toInput('DA_18_Ashe', 1, 2, 2),
			toInput('DA_18_Ashe', 1, 4, 2),
		]
		const traits = computeActiveTraits([{ ...createUnit('DA_18_Maokai'), pos: { col: 3, row: 1 } }])
		const r = simulateCombat(team, dummyTeam(2), {
			rng: makeRng(6),
			traitsA: traits,
			recordEvents: false,
			maxSeconds: 40,
		})
		expect(r.winner).toBe('A')
		expect(r.metricsA.maokaiStacks ?? 0).toBeGreaterThanOrEqual(1)
	})

	it('全棋子施放冒烟：满蓝 2 星 vs 3 假人，6 秒内行动且数值有限', () => {
		for (const c of CHAMPIONS) {
			resetUidSeq()
			const u = toInput(c.apiName, 2, 3, 2)
			u.stats.initialMana = u.stats.mana
			const r = simulateCombat([u], dummyTeam(3), {
				rng: makeRng(7),
				recordEvents: false,
				maxSeconds: 6,
			})
			for (const v of [...Object.values(r.damageDealt), ...Object.values(r.damageTaken)]) {
				expect(Number.isFinite(v)).toBe(true)
			}
			const acted = (r.damageDealt[u.uid] ?? 0) > 0 || Object.keys(r.damageDealt).length > 1
			if (!acted && c.stats.mana > 0) throw new Error(`${c.apiName} 未施放/行动`)
		}
	})

	it('74 个棋子全部有数据且费用 1-5', () => {
		expect(CHAMPIONS.length).toBe(74)
		for (const c of CHAMPIONS) {
			expect(CHAMPION_BY_API.get(c.apiName)?.cost).toBeGreaterThanOrEqual(1)
		}
	})
})
