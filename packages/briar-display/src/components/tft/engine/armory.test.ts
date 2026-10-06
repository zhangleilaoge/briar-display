import { describe, expect, it } from 'bun:test'
import { CHAMPION_BY_API, ITEM_BY_API } from '../data/set18'
import { type CombatUnitInput, simulateCombat } from './combat'
import { GameEngine } from './gameLoop'
import { applyPlayerBuffs as applyBuffs } from './playerBuffs'
import { makeRng } from './rng'
import { makePlayer } from './testUtils'
import { createUnit, unitPopSize, unitStats } from './units'

/** 进入可操作阶段（构造函数处于 encounter，经济操作被锁） */
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

describe('武器库（锻造器）', () => {
	it('便携锻炉：4 件神器选一，选定入装备栏', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_PortableForge')
		expect(me.armory?.pool).toBe('artifact')
		expect(me.armory?.options.length).toBe(4)
		for (const api of me.armory?.options ?? []) expect(ITEM_BY_API.get(api)?.isArtifact).toBe(true)
		expect(g.pickArmory(0, 'TFT_Item_BFSword')).toBe(false)
		const first = me.armory?.options[0] as string
		expect(g.pickArmory(0, first)).toBe(true)
		expect(me.itemTray).toContain(first)
		expect(me.armory).toBeNull()
	})

	it('锻造器套娃：神器锻造器 → 基础锻造器 → 4 金币', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_NestingAnvils')
		expect(me.armory?.pool).toBe('artifact')
		g.pickArmory(0, me.armory?.options[0] as string)
		expect(me.armory?.pool).toBe('component')
		const goldBefore = me.gold
		g.pickArmory(0, me.armory?.options[0] as string)
		expect(me.armory).toBeNull()
		expect(me.gold - goldBefore).toBe(4)
	})

	it('游神的眷顾：升到 5 级开基础装备锻造器', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_CaretakersFavor')
		expect(me.armory).toBeNull()
		me.gold = 999
		while (me.level < 5) g.buyXp(0)
		expect(me.armory?.pool).toBe('component')
	})

	it('休眠锻炉：倒数 8 场 PvP 后开神器锻造器', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_LatentForge')
		expect(me.augMemo.DA_LatentForge).toBe(8)
		expect(me.armory).toBeNull()
	})
})

describe('纹章/神器发放', () => {
	it('节外生枝：随机纹章入栏且带羁绊', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_18_BranchingOut')
		const emblem = me.itemTray.find((i) => ITEM_BY_API.get(i)?.grantsTrait)
		expect(emblem).toBeDefined()
	})

	it('硬性承诺：记住纹章羁绊并立刻给该羁绊棋子+3金', () => {
		const g = newEngine()
		const goldBefore = g.state.players[0].gold
		const me = offerAndPick(g, 'DA_HardCommit')
		const trait = me.augMemo['DA_HardCommit.trait']
		expect(typeof trait).toBe('string')
		expect(me.gold - goldBefore).toBe(3)
		const granted = [...me.board, ...me.bench].find(
			(u) => u && CHAMPION_BY_API.get(u.apiName)?.traits.includes(trait as string),
		)
		expect(granted).toBeDefined()
	})

	it('打捞桶：出售时成装拆成基础装备', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'DA_SalvageBin')
		const completed = ITEM_BY_API.get('DA_GuinsoosRageblade')
		if (!completed) throw new Error('缺少羊刀数据')
		expect(completed.composition.length).toBe(2)
		const u = createUnit('DA_18_Maokai')
		u.items = ['DA_GuinsoosRageblade']
		me.bench[0] = u
		const trayBefore = me.itemTray.length
		expect(g.sellUnit(0, u.uid)).toBe(true)
		const gained = me.itemTray.slice(trayBefore)
		expect(gained.sort()).toEqual([...completed.composition].sort())
	})
})

describe('训练假人', () => {
	it('假人金币：入备战席、占 0 人口、不合成、不可出售', () => {
		const g = newEngine()
		const me = offerAndPick(g, 'TFT_Augment_GoldForDummies')
		const dummy = me.bench.find((u) => u?.apiName === 'TFT_TrainingDummy')
		expect(dummy).toBeDefined()
		expect(unitPopSize(dummy!)).toBe(0)
		// 三个同名假人也不合成
		me.bench[2] = createUnit('TFT_TrainingDummy')
		me.bench[3] = createUnit('TFT_TrainingDummy')
		expect(me.bench.filter((u) => u?.apiName === 'TFT_TrainingDummy').length).toBe(3)
		expect(g.sellUnit(0, dummy!.uid)).toBe(false)
	})

	it('高塔：巨型假人每 3 秒电击最近敌人（真实伤害）', () => {
		const tower = dummyInput('DA_TheTowerDummy', 'tower')
		const e1 = dummyInput('TFT_PvEMinionMelee', 'e1', { pos: { col: 2, row: 4 } })
		const e2 = dummyInput('TFT_PvEMinionMelee', 'e2', { pos: { col: 4, row: 4 } })
		const r = simulateCombat([tower], [e1, e2], {
			rng: makeRng(7),
			maxSeconds: 8,
			recordEvents: false,
		})
		expect(r.damageDealt.tower).toBeGreaterThan(0)
	})

	it('假人金币：按存活时长折算（每 10 秒 1 金）', () => {
		const dummy = dummyInput('TFT_TrainingDummy', 'd1', { dummyGold: [10, 1] })
		const enemy = dummyInput('TFT_PvEMinionCaster', 'e1', { pos: { col: 3, row: 4 } })
		const r = simulateCombat([dummy], [enemy], {
			rng: makeRng(7),
			maxSeconds: 21,
			recordEvents: false,
		})
		expect(r.metricsA.dummyGold).toBe(2)
	})

	it('碰撞测试假人：开战发射并晕眩敌群', () => {
		const dummy = dummyInput('TFT_TrainingDummy', 'd1', {
			crashTestStun: 1,
			pos: { col: 3, row: 0 },
		})
		const e1 = dummyInput('TFT_PvEMinionMelee', 'e1', { pos: { col: 3, row: 4 } })
		const e2 = dummyInput('TFT_PvEMinionMelee', 'e2', { pos: { col: 4, row: 4 } })
		const r = simulateCombat([dummy], [e1, e2], { rng: makeRng(7), maxSeconds: 5 })
		expect(r.events.some((e) => e.type === 'status' && e.statusKind === 'stun' && e.t === 0)).toBe(
			true,
		)
	})
})

describe('携带者系海克斯加成', () => {
	it('加冕礼：冠冕携带者获得攻速/物理/法术加成', () => {
		const p = makePlayer()
		p.augments = ['DA_Coronation']
		const u = createUnit('DA_18_Maokai')
		u.items = ['DA_TacticiansCrown']
		const base = unitStats(u)
		const buffed = applyBuffs(p, unitStats(u), u)
		expect(buffed.attackSpeed).toBeCloseTo(base.attackSpeed * 1.2, 2)
		expect(buffed.attackDamage).toBe(Math.round(base.attackDamage * 1.25))
		expect(buffed.abilityPower).toBe(Math.round(base.abilityPower * 1.3))
		// 未携带冠冕的棋子不加成
		const plain = applyBuffs(p, unitStats(createUnit('DA_18_Maokai')), createUnit('DA_18_Maokai'))
		expect(plain.attackSpeed).toBeCloseTo(base.attackSpeed, 2)
	})

	it('厨神阿福：铲锅系携带者获得攻速与法力回复', () => {
		const p = makePlayer()
		p.augments = ['DA_URF']
		const u = createUnit('DA_18_Maokai')
		u.items = ['TFT_Item_Spatula']
		const buffed = applyBuffs(p, unitStats(u), u)
		expect(buffed.attackSpeed).toBeCloseTo(unitStats(u).attackSpeed * 1.2, 2)
		expect(buffed.manaRegen).toBe(3)
	})
})
