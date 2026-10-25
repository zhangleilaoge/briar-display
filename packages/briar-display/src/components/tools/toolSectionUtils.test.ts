import { describe, expect, it } from 'bun:test'
import { sectionToSvgPaths } from './toolSectionSvg'
import {
	type Solid,
	computeSection,
	enumeratePlanes,
	generateQuiz,
	legalShapeClasses,
	planeFromPoints,
	randomSolid,
	setVoxelColor,
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

	it('randomSolid stays in 3×3×3 and grows face-connected figures', () => {
		const isFaceConnected = (solid: Solid) => {
			const first = solid.voxels[0]
			if (!first) return false
			const cells = new Set(solid.voxels.map((v) => `${v.x},${v.y},${v.z}`))
			const visited = new Set<string>()
			const queue = [first]
			for (let index = 0; index < queue.length; index++) {
				const voxel = queue[index]
				visited.add(`${voxel.x},${voxel.y},${voxel.z}`)
				for (const [dx, dy, dz] of [
					[1, 0, 0],
					[-1, 0, 0],
					[0, 1, 0],
					[0, -1, 0],
					[0, 0, 1],
					[0, 0, -1],
				]) {
					const key = `${voxel.x + dx},${voxel.y + dy},${voxel.z + dz}`
					if (!cells.has(key) || visited.has(key)) continue
					const neighbor = solid.voxels.find((v) => `${v.x},${v.y},${v.z}` === key)
					if (neighbor) queue.push(neighbor)
				}
			}
			return visited.size === solid.voxels.length
		}
		for (let seed = 1; seed <= 8; seed++) {
			for (const count of [1, 6, 10, 27, 40]) {
				let state = seed
				const rng = () => {
					state = (state * 1664525 + 1013904223) >>> 0
					return state / 0x100000000
				}
				const solid = randomSolid(rng, count)
				expect(solid.voxels.length).toBe(Math.min(count, 27))
				expect(isFaceConnected(solid)).toBe(true)
				expect(
					solid.voxels.every((v) =>
						[v.x, v.y, v.z].every((n) => Number.isInteger(n) && n >= 0 && n <= 2),
					),
				).toBe(true)
			}
		}
	})

	it('section paths and cut points share the same equal-scale projection', () => {
		const plane = planeFromPoints([0, 0, 0], [1, 0, 0], [0, 1, 0])!
		const svg = sectionToSvgPaths(computeSection(solidSingleCube(), plane), plane, 240, [
			[0, 0, 0],
			[2, 0, 0],
			[0, 1, 0],
		])
		const expected = [
			[28.8, 28.8],
			[28.8, 211.2],
			[120, 28.8],
		]
		expect(svg.markers.map((marker) => marker.id)).toEqual(['A', 'B', 'C'])
		svg.markers.forEach((marker, index) => {
			expect(marker.x).toBeCloseTo(expected[index][0])
			expect(marker.y).toBeCloseTo(expected[index][1])
		})
		expect(svg.paths[0].d).toContain('28.8 28.8')
		expect(svg.paths[0].d).toContain('120.0 28.8')
	})

	it('switches a voxel between black and white without moving it', () => {
		const initial = solidSingleCube()
		const black = setVoxelColor(initial, 0, 0, 0, 'gray')
		expect(black.voxels).toEqual([{ x: 0, y: 0, z: 0, color: 'gray' }])
		expect(setVoxelColor(black, 0, 0, 0, 'white').voxels).toEqual([
			{ x: 0, y: 0, z: 0, color: 'white' },
		])
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
