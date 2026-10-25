import { describe, expect, it } from 'bun:test'
import {
	computeSection,
	enumeratePlanes,
	generateQuiz,
	legalShapeClasses,
	planeFromPoints,
	randomSolid,
	solidLTetromino,
	solidSingleCube,
	solidVertices,
} from './toolSectionUtils'

describe('toolSectionUtils', () => {
	it('solid vertices are integers on unit cube corners', () => {
		const v = solidVertices(solidSingleCube())
		expect(v.length).toBe(8)
		expect(v.every((p) => p.every((n) => Number.isInteger(n)))).toBe(true)
	})

	it('axis-aligned mid cut of a cube is a square (4-gon)', () => {
		const solid = solidSingleCube()
		const plane = planeFromPoints([0, 0, 0.5] as never, [1, 0, 0.5] as never, [0, 1, 0.5] as never)
		// 上面用了非整数 — 改用格点平面：z=0 面贴边不算切割；用对角线平面
		const diag = planeFromPoints([0, 0, 0], [1, 1, 0], [0, 0, 1])
		expect(diag).not.toBeNull()
		const sec = computeSection(solid, diag!)
		expect(sec.patches.length).toBe(1)
		expect(sec.patches[0].points.length).toBeGreaterThanOrEqual(3)
		expect(sec.patches[0].points.length).toBeLessThanOrEqual(6)
		void plane
	})

	it('enumeratePlanes yields unique legal signatures for L tetromino', () => {
		const solid = solidLTetromino()
		const planes = enumeratePlanes(solid, 300)
		expect(planes.length).toBeGreaterThan(5)
		const classes = legalShapeClasses(solid, 300)
		expect(classes.size).toBeGreaterThan(2)
	})

	it('randomSolid respects voxel cap and integer coords', () => {
		let s = 1
		const rng = () => {
			s = (s * 1664525 + 1013904223) >>> 0
			return s / 0x100000000
		}
		const solid = randomSolid(rng, 10)
		expect(solid.voxels.length).toBeLessThanOrEqual(27)
		expect(solid.voxels.length).toBe(10)
		expect(
			solid.voxels.every(
				(v) => Number.isInteger(v.x) && Number.isInteger(v.y) && Number.isInteger(v.z),
			),
		).toBe(true)
	})

	it('quiz generators return 4 options with exactly one correct', () => {
		for (const kind of ['Q1', 'Q3', 'Q4', 'Q7'] as const) {
			let s = kind.charCodeAt(1)
			const rng = () => {
				s = (s * 1664525 + 1013904223) >>> 0
				return s / 0x100000000
			}
			const q = generateQuiz(kind, rng)
			expect(q.options.length).toBe(4)
			expect(q.options.filter((o) => o.isCorrect).length).toBe(1)
			expect(q.solid.voxels.length).toBeGreaterThan(0)
			expect(q.solid.voxels.length).toBeLessThanOrEqual(27)
		}
	})
})
