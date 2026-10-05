import { describe, expect, it } from 'bun:test'
import { CHAMPIONS, CHAMPION_BY_API } from '../data/set18'
import { CardPool } from './pool'
import { makeRng } from './rng'

describe('CardPool', () => {
	it('同种子可复现', () => {
		const a = new CardPool().rollShop(5, makeRng(42))
		const b = new CardPool().rollShop(5, makeRng(42))
		expect(a).toEqual(b)
	})

	it('1 级商店只会出 1 费', () => {
		const pool = new CardPool()
		for (const slot of pool.rollShop(1, makeRng(7))) {
			if (slot) expect(CHAMPION_BY_API.get(slot)?.cost).toBe(1)
		}
	})

	it('take 扣到 0 后返回 false；addBack 恢复', () => {
		const pool = new CardPool()
		const five = CHAMPIONS.find((c) => c.cost === 5)
		if (!five) throw new Error('no 5-cost')
		let n = 0
		while (pool.take(five.apiName)) n++
		expect(n).toBe(10)
		pool.addBack(five.apiName, 3)
		expect(pool.remainingOf(five.apiName)).toBe(3)
	})

	it('rollShop 不超过池内剩余', () => {
		const pool = new CardPool()
		const five = CHAMPIONS.filter((c) => c.cost === 5)
		for (const c of five) {
			while (pool.take(c.apiName)) {
				// 抽空 5 费池
			}
		}
		const shop = pool.rollShop(9, makeRng(1))
		for (const slot of shop) {
			if (slot) expect(CHAMPION_BY_API.get(slot)?.cost).not.toBe(5)
		}
	})
})
