import { describe, expect, it } from 'bun:test'
import { CHAMPIONS, CHAMPION_BY_API, ITEM_BY_API, ITEM_COMPONENTS } from '../data/set18'
import { CONSUMABLE_LESSER_DUPLICATOR, CONSUMABLE_REMOVER } from '../data/set18/consumables'
import {
	ARTIFACT_POOL,
	CRAFTABLE_POOL,
	LUX_TRAIT_POOL,
	RADIANT_POOL,
	checkLevelArmories,
	rerollPoolFor,
} from './armory'
import {
	type AugmentDeps,
	applyAugment,
	applyPlanningAugments,
	settleAugmentTimers,
	settleRoundHooks,
	syncLuxTraits,
} from './augmentFlow'
import { type CombatUnitInput, simulateCombat } from './combat'
import { toCombatInput } from './combatSetup'
import { applyXp, buyXp, interestGold } from './economy'
import { GameEngine } from './gameLoop'
import { WITS_END_STAGE_DAMAGE } from './items'
import { LUX_BASE } from './lux'
import { applyPlayerBuffs } from './playerBuffs'
import { CardPool } from './pool'
import { type Rng, makeRng } from './rng'
import { makePlayer } from './testUtils'
import { traitCounts } from './traits'
import type { UnitInstance } from './types'
import { addToBench, createUnit, unitStats } from './units'

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

describe('round3 扩展：delayRandom 经验/装备/弈子/复制器', () => {
	const pvpRec = { isPvE: false } as unknown as import('./types').CombatRecord

	it('爆炸式增长：即刻 7 经验；之后 3 个 PvP 回合各 7 经验，第 4 次停发', () => {
		const p = makePlayer()
		const deps = mockDeps(makeRng(1))
		applyAugment(deps, p, 'DA_ExplosiveGrowth')
		// 用同初值玩家按官方升级规则推演 N 次 7 经验作为期望值
		const expected = (n: number) => {
			const e = makePlayer()
			for (let i = 0; i < n; i++) applyXp(e, 7)
			return e
		}
		let want = expected(1)
		expect(p.level).toBe(want.level)
		expect(p.xp).toBe(want.xp)
		for (let i = 0; i < 3; i++) settleAugmentTimers(deps, p, pvpRec, 100)
		want = expected(4)
		expect(p.level).toBe(want.level)
		expect(p.xp).toBe(want.xp)
		settleAugmentTimers(deps, p, pvpRec, 100)
		expect(p.xp).toBe(want.xp)
	})

	it('弈子配送：3 个 2 费弈子入备战席；6 场 PvP 后再来 3 个', () => {
		const p = makePlayer()
		const deps = {
			...mockDeps(makeRng(1)),
			grantChampUnit: (pp: ReturnType<typeof makePlayer>, champApi: string, star = 1) => {
				const u = createUnit(champApi)
				u.star = star as typeof u.star
				return addToBench(pp, u) ? u.uid : null
			},
		}
		applyAugment(deps, p, 'DA_ChampDelivery')
		const costOfBench = () =>
			p.bench
				.filter((b): b is UnitInstance => b !== null)
				.map((u) => CHAMPION_BY_API.get(u.apiName)?.cost)
		expect(costOfBench()).toEqual([2, 2, 2])
		for (let i = 0; i < 6; i++) settleAugmentTimers(deps, p, pvpRec, 100)
		expect(costOfBench()).toEqual([2, 2, 2, 2, 2, 2])
	})

	it('窃贼帮派 II：2 个手套即刻入栏，6 场 PvP 后第 3 个', () => {
		const p = makePlayer()
		const deps = mockDeps(makeRng(1))
		applyAugment(deps, p, 'TFT6_Augment_BandOfThieves2')
		expect(p.itemTray.filter((i) => i === 'DA_ThiefsGloves').length).toBe(2)
		for (let i = 0; i < 6; i++) settleAugmentTimers(deps, p, pvpRec, 100)
		expect(p.itemTray.filter((i) => i === 'DA_ThiefsGloves').length).toBe(3)
	})

	it('团队建设：1 个次级复制器即刻，5 场 PvP 后另一个', () => {
		const p = makePlayer()
		const deps = mockDeps(makeRng(1))
		applyAugment(deps, p, 'DA_TeamBuilding')
		expect(p.itemTray.filter((i) => i === CONSUMABLE_LESSER_DUPLICATOR).length).toBe(1)
		for (let i = 0; i < 5; i++) settleAugmentTimers(deps, p, pvpRec, 100)
		expect(p.itemTray.filter((i) => i === CONSUMABLE_LESSER_DUPLICATOR).length).toBe(2)
	})

	it('锅铲厨房：随机纹章即刻，3 场 PvP 后金锅铲冠冕', () => {
		const p = makePlayer()
		const pushEmblem = () => {
			p.itemTray.push('DA_18_EmblemInferno')
		}
		const deps = { ...mockDeps(makeRng(1)), grantRandomEmblem: pushEmblem }
		applyAugment(deps, p, 'DA_TacticiansKitchen')
		expect(p.itemTray).toContain('DA_18_EmblemInferno')
		for (let i = 0; i < 3; i++) settleAugmentTimers(deps, p, pvpRec, 100)
		expect(p.itemTray).toContain('DA_TacticiansCrown')
	})
})

describe('round3 扩展：等级钩子', () => {
	it('后期专家：到达 9 级发 27 金币，未到达不发', () => {
		const p = makePlayer()
		p.level = 8
		p.augments = ['DA_LateGameSpecialist']
		const gold0 = p.gold
		checkLevelArmories(makeRng(1), p)
		expect(p.gold).toBe(gold0)
		p.level = 9
		checkLevelArmories(makeRng(1), p)
		expect(p.gold).toBe(gold0 + 27)
		checkLevelArmories(makeRng(1), p)
		expect(p.gold).toBe(gold0 + 27)
	})

	it('生日礼物：首次检查不补发；升级发 1 金 + 等级减 4 费用的 2 星弈子', () => {
		const p = makePlayer()
		p.level = 4
		p.augments = ['DA_BirthdayPresent']
		const granted: [string, number | undefined][] = []
		const grantChamp = (api: string, star?: number) => {
			granted.push([api, star])
			return 'uid'
		}
		const gold0 = p.gold
		checkLevelArmories(makeRng(1), p, grantChamp)
		expect(p.gold).toBe(gold0)
		expect(granted.length).toBe(0)
		p.level = 6
		checkLevelArmories(makeRng(1), p, grantChamp)
		expect(p.gold).toBe(gold0 + 1)
		expect(granted.length).toBe(1)
		expect(granted[0][1]).toBe(2)
		expect(CHAMPION_BY_API.get(granted[0][0])?.cost).toBe(2)
	})
})

describe('round3 扩展：携带者加成与复制器', () => {
	it('源计划上行链路：恰好 1 件装备 +100 生命与 2 法力回复，2 件不触发', () => {
		const p = makePlayer()
		p.augments = ['TFT6_Augment_CyberneticUplink2']
		const one = createUnit('DA_18_Maokai')
		one.items = ['TFT_Item_BFSword']
		const two = createUnit('DA_18_Shen')
		two.items = ['TFT_Item_BFSword', 'TFT_Item_ChainVest']
		p.board = [
			{ ...one, pos: { col: 0, row: 0 } },
			{ ...two, pos: { col: 1, row: 0 } },
		]
		const inputs = toCombatInput(p, 1)
		const oneStats = inputs.find((i) => i.uid === one.uid)?.stats
		const twoStats = inputs.find((i) => i.uid === two.uid)?.stats
		const base1 = unitStats(one)
		const base2 = unitStats(two)
		expect(oneStats?.maxHp).toBe(base1.maxHp + 100)
		expect(oneStats?.manaRegen).toBe(2)
		expect(twoStats?.maxHp).toBe(base2.maxHp)
	})

	it('正义报复：正义之手携带者 +25% 暴击并获得技能暴击标签，未携带者无', () => {
		const p = makePlayer()
		p.augments = ['DA_Retribution']
		const holder = createUnit('DA_18_Maokai')
		holder.items = ['DA_HandOfJustice']
		const plain = createUnit('DA_18_Shen')
		p.board = [
			{ ...holder, pos: { col: 0, row: 0 } },
			{ ...plain, pos: { col: 1, row: 0 } },
		]
		const inputs = toCombatInput(p, 1)
		const holderInput = inputs.find((i) => i.uid === holder.uid)
		const plainInput = inputs.find((i) => i.uid === plain.uid)
		expect(holderInput?.stats.critChance).toBeCloseTo(unitStats(holder).critChance + 0.25)
		expect(holderInput?.extraTags).toContain('abilityCrit')
		expect(plainInput?.extraTags).toBeUndefined()
	})

	it('英雄复制器：生成同星复制体入备战席；次级复制器拒 4 费且不退消耗品', () => {
		const g = newEngine()
		const me = g.state.players[0]
		const four = createUnit(CHAMPIONS.find((c) => c.cost === 4)?.apiName ?? 'DA_18_Shen')
		me.bench[0] = four
		me.itemTray = ['DA_Consumable_ChampionDuplicator', 'DA_Consumable_LesserChampionDuplicator']
		// 次级复制器：4 费拒绝，消耗品保留
		expect(g.equipItem(0, four.uid, 'DA_Consumable_LesserChampionDuplicator')).toBe(false)
		expect(me.itemTray.length).toBe(2)
		// 英雄复制器：复制成功，同星复制体在备战席
		expect(g.equipItem(0, four.uid, 'DA_Consumable_ChampionDuplicator')).toBe(true)
		const copies = me.bench.filter(
			(b): b is UnitInstance => b !== null && b.apiName === four.apiName,
		)
		expect(copies.length).toBe(2)
		expect(copies[1].star).toBe(four.star)
		expect(me.itemTray).toEqual(['DA_Consumable_LesserChampionDuplicator'])
	})
})

describe('round4 属性/条件/回合钩子', () => {
	it('condBuff noItems：应急护甲只给无装备弈子加双抗', () => {
		const p = makePlayer()
		p.augments = ['DA_MakeshiftArmorII']
		const naked = createUnit('DA_18_Shen')
		const geared = createUnit('DA_18_Shen')
		geared.items = ['TFT_Item_BFSword']
		const sNaked = applyPlayerBuffs(p, unitStats(naked), naked)
		const sGeared = applyPlayerBuffs(p, unitStats(geared), geared)
		expect(sNaked.armor).toBe(unitStats(naked).armor + 50)
		expect(sGeared.armor).toBe(unitStats(geared).armor)
	})

	it('condBuff backRow：玻璃大炮后排 -20% 生命 +16% 伤害增幅', () => {
		const p = makePlayer()
		p.augments = ['DA_GlassCannon_Silver']
		const back = { ...createUnit('DA_18_Shen'), pos: { col: 0, row: 3 } }
		const front = { ...createUnit('DA_18_Shen'), pos: { col: 0, row: 0 } }
		p.board = [back as never, front as never]
		const sBack = applyPlayerBuffs(p, unitStats(back), back)
		const sFront = applyPlayerBuffs(p, unitStats(front), front)
		expect(sBack.maxHp).toBe(Math.round(unitStats(back).maxHp * 0.8))
		expect(sBack.damageAmp).toBeCloseTo(0.16)
		expect(sFront.maxHp).toBe(unitStats(front).maxHp)
		expect(sFront.damageAmp).toBe(0)
	})

	it('condBuff frontCenter：C位的觉悟只命中前排中心', () => {
		const p = makePlayer()
		p.augments = ['DA_FindYourCenter']
		const center = { ...createUnit('DA_18_Shen'), pos: { col: 3, row: 0 } }
		const off = { ...createUnit('DA_18_Shen'), pos: { col: 2, row: 0 } }
		p.board = [center as never, off as never]
		const sCenter = applyPlayerBuffs(p, unitStats(center), center)
		const sOff = applyPlayerBuffs(p, unitStats(off), off)
		expect(sCenter.damageAmp).toBeCloseTo(0.15)
		expect(sOff.damageAmp).toBe(0)
	})

	it('浪人：无邻格友军的弈子获得 20% 开战护盾', () => {
		const p = makePlayer()
		p.augments = ['TFT6_Augment_Distancing']
		const lone = { ...createUnit('DA_18_Shen'), pos: { col: 0, row: 0 } }
		const buddy = { ...createUnit('DA_18_Shen'), pos: { col: 5, row: 3 } }
		const buddy2 = { ...createUnit('DA_18_Shen'), pos: { col: 5, row: 2 } }
		p.board = [lone as never, buddy as never, buddy2 as never]
		const sLone = applyPlayerBuffs(p, unitStats(lone), lone)
		const sBuddy = applyPlayerBuffs(p, unitStats(buddy), buddy)
		expect(sLone.startShieldPct).toBeCloseTo(0.2)
		expect(sBuddy.startShieldPct).toBeUndefined()
	})

	it('teamBuff 新维度：星界赐福全能吸血/珠光莲花暴击+技能暴击入战斗', () => {
		const p = makePlayer()
		p.augments = ['DA_CelestialBlessingI', 'DA_JeweledLotus_I']
		const u = { ...createUnit('DA_18_Shen'), pos: { col: 0, row: 0 } }
		p.board = [u as never]
		const [input] = toCombatInput(p, 1)
		expect(input.stats.omnivamp).toBeCloseTo(0.12)
		expect(input.stats.critChance).toBeCloseTo(0.35) // 基础 0.25 + 珠光 0.1
		expect(input.extraTags).toContain('abilityCrit')
	})

	it('roundEndXp：清晰头脑备战席空 +3 经验；纷乱头脑备战席满 +3', () => {
		const deps = mockDeps(makeRng(1))
		const p1 = makePlayer(4)
		p1.augments = ['DA_ClearMind']
		settleRoundHooks(deps, p1, true, true)
		expect(p1.xp).toBe(3)
		p1.bench[0] = createUnit('DA_18_Shen')
		settleRoundHooks(deps, p1, true, true)
		expect(p1.xp).toBe(3)
		const p2 = makePlayer(4)
		p2.augments = ['DA_ClutteredMind']
		for (let i = 0; i < p2.bench.length; i++) p2.bench[i] = createUnit('DA_18_Shen')
		settleRoundHooks(deps, p2, true, true)
		expect(p2.xp).toBe(3)
	})

	it('combatResultXp：耐心学习胜 3 负 2（PvE 不触发）', () => {
		const deps = mockDeps(makeRng(1))
		const p = makePlayer(4)
		p.augments = ['DA_PatientStudy']
		settleRoundHooks(deps, p, true, true)
		expect(p.xp).toBe(3)
		p.xp = 0
		settleRoundHooks(deps, p, false, true)
		expect(p.xp).toBe(2)
		p.xp = 0
		settleRoundHooks(deps, p, null, false)
		expect(p.xp).toBe(0)
	})

	it('rampBuff：打气每回合叠层并反映在攻速；猛将的荣耀封顶 4 层', () => {
		const deps = mockDeps(makeRng(1))
		const p = makePlayer(4)
		p.augments = ['TFT9_PumpingUp', 'TFT_Augment_Unforgotten']
		const u = createUnit('DA_18_Shen')
		const base = unitStats(u).attackSpeed
		// 初始：打气 12 层*0.5%=6%；猛将的荣耀只加物法不加攻速
		const s0 = applyPlayerBuffs(p, unitStats(u), u)
		expect(s0.attackSpeed).toBeCloseTo(base * 1.06, 2)
		for (let i = 0; i < 30; i++) settleRoundHooks(deps, p, true, true)
		const sN = applyPlayerBuffs(p, unitStats(u), u)
		expect(sN.attackSpeed).toBeGreaterThan(s0.attackSpeed)
		// 猛将的荣耀 maxStacks=4 → adPct 封顶 20%
		const sAd = applyPlayerBuffs(p, { ...unitStats(u), attackDamage: 100 }, u)
		expect(sAd.attackDamage).toBe(120)
	})

	it('playerHp/noInterest/buyXpBonus/xpCostDiscount', () => {
		const p = makePlayer(5)
		const deps = mockDeps(makeRng(1))
		applyAugment(deps, p, 'TFT6_Augment_TinyTitans')
		applyAugment(deps, p, 'DA_Hustler')
		expect(p.hp).toBe(120)
		p.gold = 60
		expect(interestGold(p.gold, p)).toBe(0)
		applyAugment(deps, p, 'DA_LevelUp')
		applyAugment(deps, p, 'DA_UpwardMobility')
		p.gold = 10
		const xpBefore = p.xp
		expect(buyXp(p)).toBe(true)
		expect(p.gold).toBe(7) // 4-1 折扣
		expect(p.xp - xpBefore).toBe(6) // 4+2 升级咯
	})

	it('worthTheWait：每回合开始发记名弈子复制体', () => {
		const deps = mockDeps(makeRng(7))
		const granted: string[] = []
		deps.grantChampUnit = (pp, api) => {
			granted.push(api)
			return null
		}
		const p = makePlayer()
		applyAugment(deps, p, 'DA_WorththeWait')
		expect(granted.length).toBe(1)
		expect(typeof p.augMemo['DA_WorththeWait.champ']).toBe('string')
		applyPlanningAugments(deps, p, false, true)
		expect(granted.length).toBe(2)
	})

	it('levelUpBonus：大买特买升级发 等级+1 次刷新；花到上头 PvP 回合开始 +3 金', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_ShoppingSpree')
		expect(me.gold).toBe(6)
		me.level = 5
		me.gold = 50
		me.xp = 16
		g.buyXp(0) // 5→6 级
		expect(me.freeRerolls).toBe(7) // 等级 6 + 1
		const g2 = newEngine()
		const me2 = offerAndPick(g2, 'DA_Hustler')
		expect(me2.gold).toBe(3)
		me2.gold = 0
		applyPlanningAugments(mockDeps(makeRng(1)), me2, false, true)
		expect(me2.gold).toBe(3)
	})
})

describe('round4 战斗内计时增益', () => {
	it('飞升：12 秒后伤害增幅生效；发条增速器每 3 秒叠加攻速', () => {
		const p = makePlayer(4)
		p.augments = ['DA_Ascension', 'DA_ClockworkAccelerator']
		const u = { ...createUnit('DA_18_Shen'), pos: { col: 0, row: 0 } }
		p.board = [u as never]
		const [input] = toCombatInput(p, 1)
		expect(input.timerBuffs?.length).toBe(2)
		// 单弈子对战假人：12 秒后才出现 buff 事件
		const dummy = dummyInput('TFT_TrainingDummy', 'd1', {
			pos: { col: 0, row: 0 },
			stats: { ...dummyInput('TFT_TrainingDummy', 'dx').stats, maxHp: 3000, mana: 9999 },
		})
		const early = simulateCombat([input], [dummy], { rng: makeRng(3), maxSeconds: 5 })
		expect(early.events.filter((e) => e.type === 'buff').length).toBe(1) // 增速器 3 秒首次触发
		const full = simulateCombat([input], [dummy], { rng: makeRng(3), maxSeconds: 16 })
		const buffs = full.events.filter((e) => e.type === 'buff')
		expect(buffs.length).toBeGreaterThanOrEqual(6) // 飞升 1 次(12s) + 增速器 5 次(3/6/9/12/15s)
	})
})

describe('round4 战斗事件触发', () => {
	it('治疗法球：敌方阵亡时治疗最近友军', () => {
		const p = makePlayer(4)
		p.augments = ['DA_HealingOrbsI']
		const hurt = { ...createUnit('DA_18_Shen'), pos: { col: 0, row: 0 } }
		p.board = [hurt as never]
		const [input] = toCombatInput(p, 1)
		expect(input.deathHeal).toBe(250)
		const frail = dummyInput('TFT_TrainingDummy', 'd1', {
			pos: { col: 0, row: 0 },
			stats: { ...dummyInput('TFT_TrainingDummy', 'dx').stats, maxHp: 1 },
		})
		const tough = dummyInput('TFT_TrainingDummy', 'd2', {
			pos: { col: 1, row: 0 },
			stats: { ...dummyInput('TFT_TrainingDummy', 'dy').stats, maxHp: 3000 },
		})
		const res = simulateCombat([input], [frail, tough], { rng: makeRng(5), maxSeconds: 30 })
		expect(res.events.some((e) => e.type === 'heal' && e.value === 250)).toBe(true)
	})

	it('战争财宝：按敌方阵亡数概率掉金（PvE 不触发）', () => {
		const deps = mockDeps(makeRng(2))
		const p = makePlayer(4)
		p.augments = ['TFT9_Augment_DravenSpoilsOfWar3'] // 40%
		let goldTotal = 0
		for (let i = 0; i < 200; i++) {
			p.gold = 0
			settleRoundHooks(deps, p, true, true, 10)
			goldTotal += p.gold
		}
		// 期望 200*10*0.4 = 800，允许大偏差
		expect(goldTotal).toBeGreaterThan(500)
		expect(goldTotal).toBeLessThan(1100)
		p.gold = 0
		settleRoundHooks(deps, p, true, false, 10)
		expect(p.gold).toBe(0)
	})
})
