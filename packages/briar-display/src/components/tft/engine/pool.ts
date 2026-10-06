import { POOL_COPIES, SHOP_ODDS, SHOP_SIZE } from '../data/rules'
import { CHAMPIONS } from '../data/set18'
import { isLuxVariant } from './lux'
import type { Rng } from './rng'

/** 8 人共享卡池：同费棋子按剩余张数加权抽取（拉克丝皮肤变体不进池，仅本体可获取） */
export class CardPool {
	private remaining = new Map<string, number>()
	private readonly byCost: string[][] = [[], [], [], [], [], []]

	constructor() {
		for (const c of CHAMPIONS) {
			if (isLuxVariant(c.apiName)) continue
			this.remaining.set(c.apiName, POOL_COPIES[c.cost] ?? 0)
			this.byCost[c.cost].push(c.apiName)
		}
	}

	remainingOf(apiName: string): number {
		return this.remaining.get(apiName) ?? 0
	}

	/** roll 一炉商店；同一炉内同名卡不超过池内剩余（预留计数） */
	rollShop(level: number, rng: Rng): (string | null)[] {
		const odds = SHOP_ODDS[Math.min(level, SHOP_ODDS.length - 1)]
		const reserved = new Map<string, number>()
		const slots: (string | null)[] = []
		for (let i = 0; i < SHOP_SIZE; i++) {
			const roll = rng.next() * 100
			let cost = 1
			let acc = 0
			for (let c = 1; c <= 5; c++) {
				acc += odds[c - 1]
				if (roll < acc) {
					cost = c
					break
				}
			}
			const available = (api: string) => this.remainingOf(api) - (reserved.get(api) ?? 0)
			const candidates = this.byCost[cost].filter((api) => available(api) > 0)
			if (candidates.length === 0) {
				slots.push(null)
				continue
			}
			const total = candidates.reduce((sum, api) => sum + available(api), 0)
			let r = rng.next() * total
			let picked = candidates[candidates.length - 1]
			for (const api of candidates) {
				r -= available(api)
				if (r < 0) {
					picked = api
					break
				}
			}
			reserved.set(picked, (reserved.get(picked) ?? 0) + 1)
			slots.push(picked)
		}
		return slots
	}

	take(apiName: string): boolean {
		const left = this.remainingOf(apiName)
		if (left <= 0) return false
		this.remaining.set(apiName, left - 1)
		return true
	}

	/** 出售/回合重置时按星级折算回池（2★=3 张，3★=9 张） */
	addBack(apiName: string, copies = 1): void {
		this.remaining.set(apiName, this.remainingOf(apiName) + copies)
	}
}
