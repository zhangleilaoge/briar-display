import { describe, expect, it } from 'bun:test'
import { ASSEMBLY_START_OFFSET, assemblyPieceOffset } from './toolSectionAssembly'

describe('toolSectionAssembly', () => {
	it('starts separated, moves smoothly and finishes at the target', () => {
		expect(assemblyPieceOffset(0)).toEqual(ASSEMBLY_START_OFFSET)
		const middle = assemblyPieceOffset(0.5)
		expect(middle).toEqual([0.3125, 0.1875, 0.1875])
		expect(assemblyPieceOffset(1)).toEqual([0, 0, 0])
	})

	it('clamps progress outside the animation range', () => {
		expect(assemblyPieceOffset(-1)).toEqual(ASSEMBLY_START_OFFSET)
		expect(assemblyPieceOffset(2)).toEqual([0, 0, 0])
	})
})
