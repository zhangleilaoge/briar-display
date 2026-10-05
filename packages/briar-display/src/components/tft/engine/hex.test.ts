import { describe, expect, it } from 'bun:test'
import { hexDistance, hexesInRange, neighbors, stepToward, toCombatRow } from './hex'

describe('hex', () => {
	it('距离：自身为 0，对称，三角不等', () => {
		expect(hexDistance({ col: 3, row: 3 }, { col: 3, row: 3 })).toBe(0)
		const a = { col: 1, row: 2 }
		const b = { col: 5, row: 6 }
		expect(hexDistance(a, b)).toBe(hexDistance(b, a))
		expect(hexDistance(a, b)).toBeGreaterThan(0)
	})

	it('中心格 6 邻居，角落更少', () => {
		expect(neighbors({ col: 3, row: 4 }).length).toBe(6)
		expect(neighbors({ col: 0, row: 0 }).length).toBeLessThan(6)
		expect(neighbors({ col: 0, row: 0 }).length).toBeGreaterThanOrEqual(2)
	})

	it('hexesInRange(1) = 7 格，range(2) = 19 格', () => {
		expect(hexesInRange({ col: 3, row: 3 }, 1).length).toBe(7)
		expect(hexesInRange({ col: 3, row: 3 }, 2).length).toBe(19)
	})

	it('stepToward 空地直行收敛', () => {
		const from = { col: 0, row: 4 }
		const to = { col: 6, row: 4 }
		let cur = from
		let steps = 0
		while (!(cur.col === to.col && cur.row === to.row) && steps < 20) {
			const next = stepToward(cur, to, () => true)
			expect(next).not.toBeNull()
			cur = next as typeof cur
			steps++
		}
		expect(cur).toEqual(to)
		expect(steps).toBe(hexDistance(from, to))
	})

	it('stepToward 绕障：整列封死留一个缺口仍可到达', () => {
		const from = { col: 0, row: 0 }
		const to = { col: 4, row: 0 }
		const isFree = (p: { col: number; row: number }) => !(p.col === 2 && p.row !== 7)
		let cur = from
		for (let i = 0; i < 40; i++) {
			if (cur.col === to.col && cur.row === to.row) break
			const next = stepToward(cur, to, isFree)
			expect(next).not.toBeNull()
			cur = next as typeof cur
		}
		expect(cur).toEqual(to)
	})

	it('战斗镜像：防守 0..3 行映射 3..0，进攻映射 4..7', () => {
		expect(toCombatRow(0, 'defender')).toBe(3)
		expect(toCombatRow(3, 'defender')).toBe(0)
		expect(toCombatRow(0, 'attacker')).toBe(4)
		expect(toCombatRow(3, 'attacker')).toBe(7)
	})
})
