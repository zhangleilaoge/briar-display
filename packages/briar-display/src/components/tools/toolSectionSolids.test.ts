import { describe, expect, it } from 'bun:test'
import {
	QUIZ_SOLID_PRESETS,
	ROTATION_MATRICES,
	areSolidsCongruent,
	gridSignature,
	mirrorSolid,
	orthographicView,
	rotateSolid,
} from './toolSectionSolids'

const L_SOLID = {
	voxels: [
		{ x: 0, y: 0, z: 0 },
		{ x: 1, y: 0, z: 0 },
		{ x: 0, y: 1, z: 0 },
	],
}

describe('toolSectionSolids', () => {
	it('provides a varied preset library and all 24 proper rotations', () => {
		expect(QUIZ_SOLID_PRESETS.length).toBeGreaterThanOrEqual(10)
		expect(ROTATION_MATRICES).toHaveLength(24)
		expect(new Set(ROTATION_MATRICES.map((matrix) => JSON.stringify(matrix))).size).toBe(24)
		for (const preset of QUIZ_SOLID_PRESETS) {
			for (let index = 0; index < 24; index++) {
				expect(areSolidsCongruent(preset.solid, rotateSolid(preset.solid, index))).toBe(true)
			}
		}
		expect(
			QUIZ_SOLID_PRESETS.some(
				(preset) => !areSolidsCongruent(preset.solid, mirrorSolid(preset.solid, 0)),
			),
		).toBe(true)
	})

	it('distinguishes mirror images from proper rotations for a chiral shape', () => {
		const chiral = QUIZ_SOLID_PRESETS.find((preset) => preset.id === 'zigzag-6')!.solid
		expect(areSolidsCongruent(chiral, mirrorSolid(chiral, 0))).toBe(false)
		expect(areSolidsCongruent(chiral, rotateSolid(chiral, 13))).toBe(true)
	})

	it('computes front, side and top occupancy from the actual solid', () => {
		const front = orthographicView(L_SOLID, 'front')
		expect(front.rows).toBe(2)
		expect(front.cols).toBe(2)
		expect(front.cells).toHaveLength(3)
		expect(gridSignature(front)).toContain('0,0')
		expect(gridSignature(front)).not.toContain('0,1')
		expect(orthographicView(L_SOLID, 'side').cells).toHaveLength(2)
		expect(orthographicView(L_SOLID, 'top').cells).toHaveLength(2)
	})
})
