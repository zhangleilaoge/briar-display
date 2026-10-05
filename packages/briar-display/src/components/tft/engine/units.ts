import { STAR_STAT_MULT, UNIT_MAX_ITEMS, sellPriceOf } from '../data/rules'
import { CHAMPION_BY_API } from '../data/set18'
import { autoCraftOnUnit, itemStatMods } from './items'
import { applyMods } from './statsMods'
import type { BoardUnit, CombatStats, PlayerState, StarLevel, UnitInstance } from './types'

let uidSeq = 0
/** 开新对局/测试前重置，保证 uid 可复现 */
export const resetUidSeq = () => {
	uidSeq = 0
}

export function createUnit(apiName: string, star: StarLevel = 1): UnitInstance {
	if (!CHAMPION_BY_API.has(apiName)) throw new Error(`unknown champion ${apiName}`)
	uidSeq += 1
	return { uid: `u${uidSeq}`, apiName, star, items: [] }
}

export const costOf = (apiName: string) => CHAMPION_BY_API.get(apiName)?.cost ?? 1

/** 基础面板 x 星级倍率 + 装备（不含羁绊修饰，羁绊由 traits.ts 结算） */
export function unitStats(unit: UnitInstance): CombatStats {
	const c = CHAMPION_BY_API.get(unit.apiName)
	if (!c) throw new Error(`unknown champion ${unit.apiName}`)
	const m = STAR_STAT_MULT[unit.star]
	const stats: CombatStats = {
		maxHp: c.stats.hp * m,
		attackDamage: c.stats.damage * m,
		abilityPower: 100,
		attackSpeed: c.stats.attackSpeed,
		armor: c.stats.armor,
		magicResist: c.stats.magicResist,
		mana: c.stats.mana,
		initialMana: c.stats.initialMana,
		range: c.stats.range,
		critChance: c.stats.critChance,
		critMultiplier: c.stats.critMultiplier,
		manaRegen: 0,
		damageAmp: 0,
		damageReduction: 0,
		omnivamp: 0,
	}
	for (const itemApi of unit.items) applyMods(stats, itemStatMods(itemApi))
	stats.maxHp = Math.round(stats.maxHp)
	stats.attackDamage = Math.round(stats.attackDamage)
	return stats
}

export const boardUsed = (p: PlayerState) => p.board.length

export const firstFreeBench = (p: PlayerState) => p.bench.findIndex((s) => s === null)

export function addToBench(p: PlayerState, u: UnitInstance): boolean {
	const i = firstFreeBench(p)
	if (i < 0) return false
	p.bench[i] = u
	tryCombine(p)
	return true
}

interface Located {
	unit: UnitInstance
	where: 'board' | 'bench'
	index: number
}

export function findUnit(p: PlayerState, uid: string): Located | null {
	const bi = p.board.findIndex((b) => b.uid === uid)
	if (bi >= 0) return { unit: p.board[bi], where: 'board', index: bi }
	const si = p.bench.findIndex((s) => s?.uid === uid)
	if (si >= 0) return { unit: p.bench[si] as UnitInstance, where: 'bench', index: si }
	return null
}

export function removeUnit(p: PlayerState, uid: string): UnitInstance | null {
	const f = findUnit(p, uid)
	if (!f) return null
	if (f.where === 'board') p.board.splice(f.index, 1)
	else p.bench[f.index] = null
	return f.unit
}

/** 三合一升星；保留场上棋子的位置，装备合并、溢出（>3 件）回装备栏 */
export function tryCombine(p: PlayerState): boolean {
	let combined = false
	for (;;) {
		const entries: { u: UnitInstance; onBoard: boolean }[] = [
			...p.board.map((u) => ({ u, onBoard: true })),
			...p.bench.flatMap((u) => (u ? [{ u, onBoard: false }] : [])),
		]
		const groups = new Map<string, typeof entries>()
		for (const e of entries) {
			if (e.u.star >= 3) continue
			const k = `${e.u.apiName}|${e.u.star}`
			const g = groups.get(k) ?? []
			g.push(e)
			groups.set(k, g)
		}
		const triple = [...groups.values()].find((g) => g.length >= 3)
		if (!triple) return combined
		combined = true
		const keeper = (triple.find((e) => e.onBoard) ?? triple[0]).u
		const consumed = triple.filter((e) => e.u !== keeper).slice(0, 2)
		for (const e of consumed) removeUnit(p, e.u.uid)
		keeper.star = (keeper.star + 1) as StarLevel
		const merged = [...keeper.items, ...consumed.flatMap((e) => e.u.items)]
		keeper.items = merged.slice(0, UNIT_MAX_ITEMS)
		p.itemTray.push(...merged.slice(UNIT_MAX_ITEMS))
	}
}

/** 出售：返回金币；装备退回装备栏。价格 = 费用 x 3^(star-1) */
export function sellUnit(p: PlayerState, uid: string): number | null {
	const f = findUnit(p, uid)
	if (!f) return null
	removeUnit(p, uid)
	p.itemTray.push(...f.unit.items)
	const gold = sellPriceOf(costOf(f.unit.apiName), f.unit.star)
	p.gold += gold
	return gold
}

/** 从装备栏给棋子穿装；散件落在散件上自动合成成装 */
export function equipItem(p: PlayerState, uid: string, itemApi: string): boolean {
	const f = findUnit(p, uid)
	if (!f || f.unit.items.length >= UNIT_MAX_ITEMS) return false
	const ti = p.itemTray.indexOf(itemApi)
	if (ti < 0) return false
	p.itemTray.splice(ti, 1)
	f.unit.items.push(itemApi)
	autoCraftOnUnit(f.unit.items)
	return true
}

/** 棋盘/备战席间移动；目标格有子则交换（回来源格）。返回是否成功 */
export function placeOnBoard(p: PlayerState, uid: string, col: number, row: number): boolean {
	const f = findUnit(p, uid)
	if (!f) return false
	const fromPos = f.where === 'board' ? { ...(f.unit as BoardUnit).pos } : null
	const fromBenchIndex = f.where === 'bench' ? f.index : -1
	const occupantIdx = p.board.findIndex((b) => b.pos.col === col && b.pos.row === row)
	const occupant = occupantIdx >= 0 ? p.board[occupantIdx] : null
	if (occupant?.uid === uid) return true
	if (f.where === 'bench' && !occupant && p.board.length >= p.level) return false
	if (f.where === 'board') p.board.splice(f.index, 1)
	else p.bench[fromBenchIndex] = null
	if (occupant) {
		p.board.splice(p.board.indexOf(occupant), 1)
		if (fromPos) p.board.push({ ...occupant, pos: fromPos })
		else
			p.bench[fromBenchIndex] = {
				uid: occupant.uid,
				apiName: occupant.apiName,
				star: occupant.star,
				items: occupant.items,
			}
	}
	p.board.push({ ...f.unit, pos: { col, row } })
	return true
}

/** 从棋盘收回备战席；备战格有子则交换到腾出的棋盘位 */
export function moveToBench(p: PlayerState, uid: string, benchIndex: number): boolean {
	const f = findUnit(p, uid)
	if (!f || f.where !== 'board') return false
	if (benchIndex < 0 || benchIndex >= p.bench.length) return false
	const pos = { ...(f.unit as BoardUnit).pos }
	const benchOccupant = p.bench[benchIndex]
	p.board.splice(f.index, 1)
	p.bench[benchIndex] = f.unit
	if (benchOccupant) p.board.push({ ...benchOccupant, pos })
	return true
}
