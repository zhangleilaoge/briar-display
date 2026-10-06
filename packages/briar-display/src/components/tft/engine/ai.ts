import { CHAMPION_BY_API } from '../data/set18'
import { CONSUMABLE_ALPHA_MARK, isConsumable } from '../data/set18/consumables'
import { xpNeeded } from './economy'
import type { GameEngine } from './gameLoop'
import type { Rng } from './rng'
import type { PlayerState, UnitInstance } from './types'
import { boardUsed, costOf, placeOnBoard, teamCap, unitPopSize } from './units'

const unitValue = (u: UnitInstance) => costOf(u.apiName) * 3 ** (u.star - 1)

/** 折合成 1★ 张数（2★=3，3★=9），用于凑对判断 */
const copiesOf = (p: PlayerState, apiName: string) =>
	[...p.board, ...p.bench]
		.filter((u): u is UnitInstance => !!u && u.apiName === apiName)
		.reduce((sum, u) => sum + 3 ** (u.star - 1), 0)

/** 备战席 → 棋盘自动补位（开战时调用，近战前排远程后排，填满人口上限为止） */
export function autoDeploy(p: PlayerState, rng: Rng): void {
	for (;;) {
		const room = teamCap(p) - boardUsed(p)
		if (room <= 0) return
		const bench = p.bench.filter((u): u is UnitInstance => !!u && unitPopSize(u) <= room)
		if (bench.length === 0) return
		const best = bench.sort((a, b) => unitValue(b) - unitValue(a))[0]
		const range = CHAMPION_BY_API.get(best.apiName)?.stats.range ?? 1
		const rows = range <= 1 ? [0, 1] : [3, 2]
		let placed = false
		for (const row of rows) {
			const cols = [3, 2, 4, 1, 5, 0, 6]
			for (const col of rng.shuffle(cols)) {
				if (p.board.some((b) => b.pos.col === col && b.pos.row === row)) continue
				if (placeOnBoard(p, best.uid, col, row)) {
					placed = true
					break
				}
			}
			if (placed) break
		}
		if (!placed) return
	}
}

/** bot 一回合的决策：升级 → 买子 → 刷新 → 摆位 → 装备 */
export function aiTakeTurn(g: GameEngine, p: PlayerState, rng: Rng): void {
	if (!p.alive) return
	// 前期放开经济保证满员出战，中期起保留利息线
	const reserve = p.level >= 6 ? 40 : p.level >= 4 ? 20 : p.level >= 3 ? 10 : 2

	// 升级：缺口小或经济富余时 F
	const need = xpNeeded(p.level) - p.xp
	while (p.level < 9 && p.gold >= 4 + reserve && (need <= 8 || p.gold > 60)) {
		if (!g.buyXp(p.id)) break
	}

	// 买子：先填满人口，再凑对 > 高费；保留利息线
	const fielded = () => p.board.length + p.bench.filter((u) => u !== null).length
	const buyOnce = (): boolean => {
		for (let slot = 0; slot < p.shop.length; slot++) {
			const api = p.shop[slot]
			if (!api) continue
			const cost = costOf(api)
			const owned = copiesOf(p, api)
			const want =
				fielded() < teamCap(p) + 2 ||
				(owned > 0 && owned % 9 !== 0) ||
				cost >= 4 ||
				(cost >= 3 && p.level >= 5)
			if (!want || p.gold - cost < reserve) continue
			if (g.buyShopSlot(p.id, slot)) return true
		}
		return false
	}
	while (buyOnce()) {
		// 买到没钱/没需求为止
	}

	// 经济富余时 D 牌再找一轮
	if (p.gold > 60 && g.refreshShop(p.id)) while (buyOnce()) {}

	// 摆位：近战前排（0..1 行），远程后排（2..3 行），中列展开
	autoDeploy(p, rng)

	// 装备全给最高价值棋子（散件在身上自动合成；阿尔法印记给野怪棋子；其余消耗品留着不用）
	const carry = [...p.board].sort((a, b) => unitValue(b) - unitValue(a))[0]
	if (carry) {
		for (const item of [...p.itemTray]) {
			if (isConsumable(item)) continue
			if (!g.equipItem(p.id, carry.uid, item)) break
		}
	}
	if (p.itemTray.includes(CONSUMABLE_ALPHA_MARK)) {
		const beast = p.board.find(
			(u) => CHAMPION_BY_API.get(u.apiName)?.traits.includes('DA_Riftbeast18') && !u.alphaMark,
		)
		if (beast) g.equipItem(p.id, beast.uid, CONSUMABLE_ALPHA_MARK)
	}

	// 魔女精粹够兑换就收菜
	while (g.redeemCoven(p.id)) {}
}
