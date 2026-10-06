import { describe, expect, it } from 'bun:test'
import { CHAMPION_BY_API, ITEM_BY_API, ITEM_COMPONENTS } from '../data/set18'
import { CONSUMABLE_REMOVER } from '../data/set18/consumables'
import {
	ARTIFACT_POOL,
	CRAFTABLE_POOL,
	LUX_TRAIT_POOL,
	RADIANT_POOL,
	rerollPoolFor,
} from './armory'
import { type AugmentDeps, applyPlanningAugments, syncLuxTraits } from './augmentFlow'
import { type CombatUnitInput, simulateCombat } from './combat'
import { toCombatInput } from './combatSetup'
import { GameEngine } from './gameLoop'
import { WITS_END_STAGE_DAMAGE } from './items'
import { LUX_BASE } from './lux'
import { CardPool } from './pool'
import { type Rng, makeRng } from './rng'
import { makePlayer } from './testUtils'
import { traitCounts } from './traits'
import type { UnitInstance } from './types'
import { createUnit, unitStats } from './units'

const newEngine = (seed = 42) => {
	const g = new GameEngine(seed)
	g.state.phase = 'planning'
	return g
}

const offerAndPick = (g: GameEngine, apiName: string) => {
	g.state.augmentOffers.set(0, [apiName])
	expect(g.pickAugment(0, apiName)).toBe(true)
	return g.state.players[0]
}

const dummyInput = (
	apiName: string,
	uid: string,
	extra?: Partial<CombatUnitInput>,
): CombatUnitInput => ({
	uid,
	apiName,
	star: 1,
	pos: { col: 3, row: 3 },
	stats: unitStats(createUnit(apiName)),
	items: [],
	...extra,
})

const mockDeps = (rng: Rng): AugmentDeps => ({
	rng,
	pool: new CardPool(),
	grantChampUnit: () => null,
	openArmory: () => {},
	grantRandomEmblem: () => {},
	grantStageEmblemChamp: () => {},
	checkLevelArmories: () => {},
})

// 假人化「非坦克」判定与 augmentFlow 内部同源
const TANK_TRAITS = ['DA_18_Vanguard', 'DA_18_Brawler', 'DA_18_Defender', 'DA_Juggernaut18']

describe('光明武器池', () => {
	it('光明池非空且全为光明装；成装池不含光明装', () => {
		expect(RADIANT_POOL.length).toBeGreaterThan(0)
		for (const api of RADIANT_POOL) expect(ITEM_BY_API.get(api)?.isRadiant).toBe(true)
		for (const def of CRAFTABLE_POOL) expect(def.isRadiant).toBeFalsy()
	})

	it('重铸分类：散件/神器/光明/成装各自同类变形', () => {
		const compPool = rerollPoolFor(ITEM_COMPONENTS[0].apiName)
		expect(compPool.sort()).toEqual(ITEM_COMPONENTS.map((i) => i.apiName).sort())
		for (const api of rerollPoolFor(RADIANT_POOL[0]))
			expect(ITEM_BY_API.get(api)?.isRadiant).toBe(true)
		const craftableApis = CRAFTABLE_POOL.map((i) => i.apiName)
		for (const api of rerollPoolFor('DA_GuinsoosRageblade')) expect(craftableApis).toContain(api)
		for (const api of rerollPoolFor(ARTIFACT_POOL[0]))
			expect(ITEM_BY_API.get(api)?.isArtifact).toBe(true)
	})
})

describe('光明系海克斯', () => {
	it('潘朵拉的装备 III：直接获得 1 件光明武器', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_PandorasItemsIII')
		expect(me.itemTray.some((i) => ITEM_BY_API.get(i)?.isRadiant)).toBe(true)
	})

	it('潘朵拉变形：散件/神器/成装同类保持，消耗品与铲锅不变', () => {
		const p = makePlayer()
		p.augments = ['DA_PandorasItemsIII']
		p.itemTray = [
			ITEM_COMPONENTS[0].apiName,
			ARTIFACT_POOL[0],
			'DA_GuinsoosRageblade',
			CONSUMABLE_REMOVER,
			'TFT_Item_Spatula',
		]
		applyPlanningAugments(mockDeps(makeRng(1)), p, false)
		const compApis = ITEM_COMPONENTS.map((i) => i.apiName)
		expect(compApis).toContain(p.itemTray[0])
		expect(ITEM_BY_API.get(p.itemTray[1])?.isArtifact).toBe(true)
		expect(CRAFTABLE_POOL.map((i) => i.apiName)).toContain(p.itemTray[2])
		expect(p.itemTray[3]).toBe(CONSUMABLE_REMOVER)
		expect(p.itemTray[4]).toBe('TFT_Item_Spatula')
	})

	it('光明圣物：5 件光明选一 + 1 个拆卸器', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_RadiantRelic')
		expect(me.armory?.pool).toBe('radiant')
		expect(me.armory?.options.length).toBe(5)
		for (const api of me.armory?.options ?? []) expect(ITEM_BY_API.get(api)?.isRadiant).toBe(true)
		expect(me.itemTray).toContain(CONSUMABLE_REMOVER)
		const first = me.armory?.options[0] as string
		expect(g.pickArmory(0, first)).toBe(true)
		expect(me.itemTray).toContain(first)
		expect(me.armory).toBeNull()
	})

	it('光明无赖：光明版窃贼手套入栏', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_RadiantRascal')
		expect(me.itemTray).toContain('DA_ThiefsGlovesRadiant')
	})

	it('黄金赌约：+2 金，正面光明库 5 选 1 / 反面 2 个成装锻造器排队', () => {
		let sawRadiant = false
		let sawCompleted = false
		for (let seed = 1; seed <= 20; seed++) {
			const g = newEngine(seed)
			const goldBefore = g.state.players[0].gold
			const me = offerAndPick(g, 'DA_GoldenGamble')
			expect(me.gold - goldBefore).toBe(2)
			if (me.armory?.pool === 'radiant') {
				sawRadiant = true
				expect(me.armory.options.length).toBe(5)
				for (const api of me.armory.options) expect(ITEM_BY_API.get(api)?.isRadiant).toBe(true)
				g.pickArmory(0, me.armory.options[0])
				expect(me.armory).toBeNull()
			} else {
				sawCompleted = true
				expect(me.armory?.pool).toBe('completed')
				expect(me.armory?.options.length).toBe(4)
				g.pickArmory(0, me.armory?.options[0] as string)
				// 反面给 2 个锻造器：选完第一个后第二个从队列顶上
				expect(me.armory?.pool).toBe('completed')
			}
		}
		expect(sawRadiant).toBe(true)
		expect(sawCompleted).toBe(true)
	})
})

describe('创世神拉克丝', () => {
	it('开 3 选项羁绊库，选定后发拉克丝本体+朔极之矛', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_18_LuxAugmentII')
		expect(me.armory?.pool).toBe('trait')
		expect(me.armory?.options.length).toBe(3)
		for (const t of me.armory?.options ?? []) expect(LUX_TRAIT_POOL).toContain(t)
		const trait = me.armory?.options[0] as string
		expect(g.pickArmory(0, trait)).toBe(true)
		const lux = me.bench.find((u) => u?.apiName === LUX_BASE)
		expect(lux).toBeDefined()
		expect(lux?.chosenTrait).toBe(trait)
		expect(me.itemTray).toContain('DA_SpearOfShojin')
		expect(me.armory).toBeNull()
	})

	it('拉克丝为选定羁绊提供 +2 计数', () => {
		const p = makePlayer()
		p.board = [{ ...createUnit(LUX_BASE), pos: { col: 0, row: 0 }, chosenTrait: 'DA_18_Inferno' }]
		expect(traitCounts(p.board).get('DA_18_Inferno')).toBe(2)
	})

	it('羁绊同步：已选羁绊传播给新拉克丝；无已选时开羁绊库待选', () => {
		const p = makePlayer()
		p.bench[0] = { ...createUnit(LUX_BASE), chosenTrait: 'DA_18_Inferno' }
		p.bench[1] = createUnit(LUX_BASE)
		syncLuxTraits(mockDeps(makeRng(1)), p)
		expect(p.bench[1]?.chosenTrait).toBe('DA_18_Inferno')

		const p2 = makePlayer()
		p2.bench[0] = createUnit(LUX_BASE)
		let opened = 0
		const deps = { ...mockDeps(makeRng(1)), openArmory: () => opened++ }
		syncLuxTraits(deps, p2)
		expect(opened).toBe(1)
		expect(p2.augMemo.luxPendingUid).toBe(p2.bench[0]?.uid)
	})
})

describe('假人化', () => {
	it('清空棋盘与备战席，假人继承总生命 60%，装备退回，补发 2 星 2 费非坦克', () => {
		const g = newEngine()
		const me = g.state.players[0]
		const mk = createUnit('DA_18_Maokai')
		mk.items = ['DA_GuinsoosRageblade']
		me.board = [
			{ ...mk, pos: { col: 0, row: 0 } },
			{ ...createUnit('DA_18_Shen'), pos: { col: 1, row: 0 } },
		]
		me.bench[1] = createUnit('DA_18_Kennen')
		const lost = [...me.board, ...me.bench.filter((b): b is UnitInstance => b !== null)]
		const totalHp = lost.reduce((sum, u) => sum + unitStats(u).maxHp, 0)
		offerAndPick(g, 'DA_Dummify')
		expect(me.board.length).toBe(0)
		const benchUnits = me.bench.filter((b): b is UnitInstance => b !== null)
		expect(benchUnits.length).toBe(2)
		const dummy = benchUnits.find((u) => u.apiName === 'TFT_TrainingDummy')
		expect(dummy?.hpOverride).toBe(Math.round(totalHp * 0.6))
		expect(unitStats(dummy as UnitInstance).maxHp).toBe(Math.round(totalHp * 0.6))
		expect(me.itemTray).toContain('DA_GuinsoosRageblade')
		const other = benchUnits.find((u) => u.apiName !== 'TFT_TrainingDummy')
		expect(other?.star).toBe(2)
		const def = CHAMPION_BY_API.get(other!.apiName)
		expect(def?.cost).toBe(2)
		expect(def?.traits.some((t) => TANK_TRAITS.includes(t))).toBe(false)
	})
})

describe('羁绊效能与炊具', () => {
	it('致命丽花：纹章携带者羁绊效能 +50%，未携带者无', () => {
		const p = makePlayer()
		p.augments = ['DA_18_FloraFatalisAugment']
		const mk = createUnit('DA_18_Maokai')
		mk.items = ['DA_18_EmblemFloraFatalis']
		p.board = [
			{ ...mk, pos: { col: 0, row: 0 } },
			{ ...createUnit('DA_18_Shen'), pos: { col: 1, row: 0 } },
		]
		const inputs = toCombatInput(p, 1)
		const mkInput = inputs.find((i) => i.apiName === 'DA_18_Maokai')
		const shenInput = inputs.find((i) => i.apiName === 'DA_18_Shen')
		expect(mkInput?.traitAmp?.DA_FloraFatalis18).toBe(1.5)
		expect(shenInput?.traitAmp).toBeUndefined()
	})

	it('金色炊具：铲锅携带者为最近友军叠加永久生命', () => {
		const p = makePlayer()
		p.augments = ['DA_CookingPot']
		const holder = createUnit('DA_18_Maokai')
		holder.items = ['TFT_Item_FryingPan']
		const near = createUnit('DA_18_Shen')
		const far = createUnit('DA_18_Kennen')
		p.board = [
			{ ...holder, pos: { col: 0, row: 0 } },
			{ ...near, pos: { col: 1, row: 0 } },
			{ ...far, pos: { col: 5, row: 3 } },
		]
		const deps = mockDeps(makeRng(1))
		applyPlanningAugments(deps, p, false)
		expect(p.board[1].bonusHpFlat).toBe(60)
		expect(p.board[2].bonusHpFlat).toBeUndefined()
		applyPlanningAugments(deps, p, false)
		expect(p.board[1].bonusHpFlat).toBe(120)
	})
})

describe('近似项修正', () => {
	it('智慧末刃：魔法弹伤害随阶段成长', () => {
		expect(WITS_END_STAGE_DAMAGE[0]).toBe(30)
		expect(WITS_END_STAGE_DAMAGE[4]).toBe(85)
		const mk = () => {
			const st = unitStats(createUnit('DA_18_Maokai'))
			return dummyInput('DA_18_Maokai', 'atk', {
				items: ['TFT_Item_Artifact_WitsEnd'],
				stats: { ...st, attackSpeed: 2.5 },
			})
		}
		const def = () =>
			dummyInput('TFT_PvEMinionMelee', 'def', {
				stats: { ...unitStats(createUnit('TFT_PvEMinionMelee')), maxHp: 100000, attackDamage: 0 },
				pos: { col: 3, row: 4 },
			})
		const s1 = simulateCombat([mk()], [def()], {
			rng: makeRng(7),
			maxSeconds: 5,
			recordEvents: false,
			stage: 1,
		})
		const s5 = simulateCombat([mk()], [def()], {
			rng: makeRng(7),
			maxSeconds: 5,
			recordEvents: false,
			stage: 5,
		})
		expect(s5.damageDealt.atk - s1.damageDealt.atk).toBeGreaterThan(400)
	})

	it('激发之匣：施法后 3 秒持续回血（HoT）', () => {
		const st = unitStats(createUnit('DA_18_Maokai'))
		const m1 = dummyInput('DA_18_Maokai', 'm1', {
			items: ['TFT_Item_Artifact_InnervatingLocket'],
			stats: { ...st, initialMana: st.mana },
		})
		const e1 = dummyInput('TFT_PvEMinionMelee', 'e1', { pos: { col: 2, row: 4 } })
		const e2 = dummyInput('TFT_PvEMinionMelee', 'e2', { pos: { col: 4, row: 4 } })
		const r = simulateCombat([m1], [e1, e2], { rng: makeRng(7), maxSeconds: 6 })
		const castAt = r.events.find((e) => e.type === 'cast' && e.uid === 'm1')?.t
		expect(castAt).toBeDefined()
		const heals = r.events.filter(
			(e) => e.type === 'heal' && e.uid === 'm1' && (e.value ?? 0) > 0 && e.t >= (castAt ?? 0),
		)
		expect(heals.length).toBeGreaterThanOrEqual(2)
	})
})
