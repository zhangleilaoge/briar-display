// 共享选秀：棋子池生成、挑选顺序、领取入队
import { CAROUSEL_COST_WEIGHTS, ITEM_TRAY_SIZE } from '../data/rules'
import { CHAMPIONS, ITEM_COMPONENTS } from '../data/set18'
import type { CardPool } from './pool'
import type { Rng } from './rng'
import type { CarouselSlot, PlayerState } from './types'
import { addToBench, costOf, createUnit } from './units'

/** 按阶段费用权重生成选秀槽位（数量=存活玩家数） */
export function genCarouselSlots(rng: Rng, stage: number, aliveCount: number): CarouselSlot[] {
	const weights = CAROUSEL_COST_WEIGHTS[Math.min(stage, 4)] ?? CAROUSEL_COST_WEIGHTS[4]
	const byCost = [1, 2, 3, 4, 5].map((c) => CHAMPIONS.filter((x) => x.cost === c))
	return Array.from({ length: aliveCount }, () => {
		let roll = rng.next() * weights.reduce((a, b) => a + b, 0)
		let cost = 1
		for (let i = 0; i < 5; i++) {
			roll -= weights[i]
			if (roll <= 0) {
				cost = i + 1
				break
			}
		}
		const pool = byCost[cost - 1]
		return {
			apiName: pool[rng.int(pool.length)].apiName,
			item: ITEM_COMPONENTS[rng.int(ITEM_COMPONENTS.length)].apiName,
		}
	})
}

/** 血量最低者优先，同血按 id */
export const carouselPickOrder = (players: PlayerState[]): number[] =>
	players
		.filter((p) => p.alive)
		.sort((a, b) => a.hp - b.hp || a.id - b.id)
		.map((p) => p.id)

/** 领取选秀棋子（带装备）；备战席满折现 */
export function grantCarouselUnit(pool: CardPool, p: PlayerState, slot: CarouselSlot): void {
	pool.take(slot.apiName)
	const u = createUnit(slot.apiName)
	if (p.itemTray.length < ITEM_TRAY_SIZE) u.items = [slot.item]
	if (!addToBench(p, u)) {
		p.gold += costOf(slot.apiName)
		pool.addBack(slot.apiName, 1)
	}
}
