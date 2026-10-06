import { beforeEach, describe, expect, it } from 'bun:test'
import { CHAMPIONS, CHAMPION_BY_API } from '../data/set18'
import { isComponent } from './items'
import { makePlayer } from './testUtils'
import {
	addToBench,
	createUnit,
	equipItem,
	moveToBench,
	placeOnBoard,
	resetUidSeq,
	sellUnit,
	unitStats,
} from './units'

const C1 = CHAMPIONS.find((c) => c.cost === 1)
const C2 = CHAMPIONS.find((c) => c.cost === 2)
if (!C1 || !C2) throw new Error('missing test champions')

beforeEach(() => resetUidSeq())

describe('units', () => {
	it('三合一升星；9 张到 3 星', () => {
		const p = makePlayer()
		for (let i = 0; i < 3; i++) expect(addToBench(p, createUnit(C1.apiName))).toBe(true)
		expect(p.bench.filter(Boolean)).toHaveLength(1)
		expect(p.bench[0]?.star).toBe(2)
		for (let i = 0; i < 6; i++) addToBench(p, createUnit(C1.apiName))
		const left = p.bench.filter(Boolean)
		expect(left).toHaveLength(1)
		expect(left[0]?.star).toBe(3)
	})

	it('星级倍率：2★ HP/AD ×1.8，3★ ×3.24', () => {
		const base = CHAMPION_BY_API.get(C1.apiName)
		if (!base) throw new Error('missing')
		const s1 = unitStats(createUnit(C1.apiName, 1))
		const s2 = unitStats(createUnit(C1.apiName, 2))
		const s3 = unitStats(createUnit(C1.apiName, 3))
		expect(s2.maxHp).toBe(Math.round(base.stats.hp * 1.8))
		expect(s3.maxHp).toBe(Math.round(base.stats.hp * 3.24))
		expect(s2.attackSpeed).toBeCloseTo(s1.attackSpeed)
	})

	it('合成保留场上位置，散件自动合成成装、溢出回装备栏', () => {
		const p = makePlayer(9)
		const onBoard = createUnit(C1.apiName)
		onBoard.items = ['TFT_Item_BFSword', 'TFT_Item_RecurveBow']
		p.board.push({ ...onBoard, pos: { col: 0, row: 0 } })
		const b1 = createUnit(C1.apiName)
		b1.items = ['TFT_Item_ChainVest', 'TFT_Item_GiantsBelt']
		const b2 = createUnit(C1.apiName)
		b2.items = ['TFT_Item_NegatronCloak']
		addToBench(p, b1)
		addToBench(p, b2)
		expect(p.board).toHaveLength(1)
		expect(p.board[0].star).toBe(2)
		// 5 件散件合成 2 件成装（BF+弓→巨人杀手、锁甲+腰带→日炎），斗篷落单 → 3 件刚好全留身上
		expect(p.board[0].items.length + p.itemTray.length).toBe(3)
		expect(p.board[0].items).toContain('DA_GiantSlayer')
		expect(p.board[0].items).toContain('DA_SunfireCape')
		expect(p.board[0].items).toContain('TFT_Item_NegatronCloak')
	})

	it('合成溢出：成装不参与再合成，超出 3 件回装备栏', () => {
		const p = makePlayer(9)
		const crafted = ['DA_GiantSlayer', 'DA_SunfireCape']
		const onBoard = createUnit(C1.apiName)
		onBoard.items = [...crafted]
		p.board.push({ ...onBoard, pos: { col: 0, row: 0 } })
		const b1 = createUnit(C1.apiName)
		b1.items = ['DA_EdgeOfNight']
		const b2 = createUnit(C1.apiName)
		b2.items = ['DA_Evenshroud']
		addToBench(p, b1)
		addToBench(p, b2)
		expect(p.board[0].star).toBe(2)
		expect(p.board[0].items).toHaveLength(3)
		expect(p.itemTray).toHaveLength(1)
	})

	it('出售：2★ 2 费卖 6 金，装备退回', () => {
		const p = makePlayer()
		for (let i = 0; i < 3; i++) addToBench(p, createUnit(C2.apiName))
		const u = p.bench.find(Boolean)
		if (!u) throw new Error('no unit')
		u.items = ['TFT_Item_BFSword']
		const gold = sellUnit(p, u.uid)
		expect(gold).toBe(6)
		expect(p.gold).toBe(6)
		expect(p.itemTray).toContain('TFT_Item_BFSword')
		expect(p.bench.filter(Boolean)).toHaveLength(0)
	})

	it('装备：满 3 件拒绝；散件落散件自动合成', () => {
		const p = makePlayer()
		const u = createUnit(C1.apiName)
		addToBench(p, u)
		p.itemTray.push('TFT_Item_BFSword', 'TFT_Item_RecurveBow')
		expect(equipItem(p, u.uid, 'TFT_Item_BFSword')).toBe(true)
		expect(equipItem(p, u.uid, 'TFT_Item_RecurveBow')).toBe(true)
		expect(u.items).toHaveLength(1)
		expect(isComponent(u.items[0])).toBe(false)
		u.items.push('TFT_Item_GiantsBelt', 'TFT_Item_ChainVest')
		p.itemTray.push('TFT_Item_TearOfTheGoddess')
		expect(equipItem(p, u.uid, 'TFT_Item_TearOfTheGoddess')).toBe(false)
	})

	it('拖动上场凑齐三张时自动合成', () => {
		const p = makePlayer(3)
		// 直接摆两只在棋盘（绕过 addToBench 的即时合成），第三只在备战席
		const a = createUnit(C1.apiName)
		const b = createUnit(C1.apiName)
		p.board.push({ ...a, pos: { col: 0, row: 0 } }, { ...b, pos: { col: 1, row: 0 } })
		const c = createUnit(C1.apiName)
		p.bench[0] = c
		expect(placeOnBoard(p, c.uid, 2, 0)).toBe(true)
		expect(p.board).toHaveLength(1)
		expect(p.board[0].star).toBe(2)
	})

	it('上棋子：受等级上限；占位交换；收台交换', () => {
		const p = makePlayer(1)
		const a = createUnit(C1.apiName)
		const b = createUnit(C2.apiName)
		addToBench(p, a)
		addToBench(p, b)
		expect(placeOnBoard(p, a.uid, 0, 0)).toBe(true)
		expect(placeOnBoard(p, b.uid, 1, 0)).toBe(false) // 1 级只能上 1 个
		expect(placeOnBoard(p, b.uid, 0, 0)).toBe(true) // 交换：b 上场，a 回备战席
		expect(p.board[0].uid).toBe(b.uid)
		const aIdx = p.bench.findIndex((s) => s?.uid === a.uid)
		expect(aIdx).toBeGreaterThanOrEqual(0)
		expect(moveToBench(p, b.uid, aIdx)).toBe(true) // 收台并与 a 换位
		expect(p.board).toHaveLength(1)
		expect(p.board[0].uid).toBe(a.uid)
		expect(p.bench[aIdx]?.uid).toBe(b.uid)
	})
})
