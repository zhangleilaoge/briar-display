import { describe, expect, it } from 'bun:test'
import {
	addVoxel,
	additionCells,
	defaultCutPoints,
	moveVoxel,
	removeVoxel,
} from './toolSectionEditor'
import { type Solid, planeFromPoints, solidLTetromino, solidSingleCube } from './toolSectionUtils'

describe('toolSectionEditor', () => {
	it('creates non-collinear default cut points for empty and non-empty solids', () => {
		for (const solid of [{ voxels: [] }, solidSingleCube(), solidLTetromino()]) {
			const [a, b, c] = defaultCutPoints(solid)
			expect(planeFromPoints(a, b, c)).not.toBeNull()
		}
	})

	it('adds to an empty model and rejects occupied or fractional cells', () => {
		const empty: Solid = { voxels: [] }
		const added = addVoxel(empty, [0, 0, 0])
		expect(added.error).toBeNull()
		expect(added.solid.voxels).toHaveLength(1)
		expect(addVoxel(added.solid, [0, 0, 0]).error).toBe('occupied')
		expect(addVoxel(added.solid, [1.5, 0, 0]).error).toBe('invalid')
		expect(additionCells(added.solid, [0, 0, 0])).toHaveLength(6)
	})

	it('only offers empty axial neighbors of the selected voxel', () => {
		expect(additionCells(solidLTetromino(), [0, 0, 0])).toEqual([
			[-1, 0, 0],
			[0, -1, 0],
			[0, 0, -1],
		])
		expect(additionCells(solidLTetromino(), null)).toEqual([])
		expect(additionCells(solidLTetromino(), [9, 9, 9])).toEqual([])
	})

	it('allows building beyond 27 voxels', () => {
		const solid: Solid = {
			voxels: Array.from({ length: 27 }, (_, x) => ({ x, y: 0, z: 0 })),
		}
		const added = addVoxel(solid, [0, 1, 0])
		expect(added.error).toBeNull()
		expect(added.solid.voxels).toHaveLength(28)
		expect(additionCells(added.solid, [0, 0, 0])).toEqual([
			[-1, 0, 0],
			[0, -1, 0],
			[0, 0, 1],
			[0, 0, -1],
		])
	})

	it('moves on integer cells and rejects collisions', () => {
		const moved = moveVoxel(solidLTetromino(), [0, 0, 0], [4, 5, 6])
		expect(moved.error).toBeNull()
		expect(moved.solid.voxels.find((voxel) => voxel.x === 4)).toMatchObject({ y: 5, z: 6 })
		expect(moveVoxel(solidLTetromino(), [0, 0, 0], [1, 0, 0]).error).toBe('occupied')
		expect(moveVoxel(solidLTetromino(), [9, 9, 9], [4, 5, 6]).error).toBe('missing')
	})

	it('allows removing the final voxel', () => {
		expect(removeVoxel(solidSingleCube(), [0, 0, 0]).voxels).toEqual([])
	})
})
