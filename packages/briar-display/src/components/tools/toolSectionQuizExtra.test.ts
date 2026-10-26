import { describe, expect, it } from 'bun:test'
import { generateQ2, generateQ5, generateQ6, generateQ8, generateQ9 } from './toolSectionQuizExtra'
import {
	areSolidsCongruent,
	gridShapeKey,
	gridSignature,
	orthographicView,
} from './toolSectionSolids'

function seededRng(seed: number) {
	let state = seed
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0
		return state / 0x100000000
	}
}

describe('toolSectionQuizExtra', () => {
	it('uses the requested orthographic direction and excludes rotation or mirror duplicates', () => {
		for (let seed = 1; seed <= 100; seed++) {
			const question = generateQ2(seededRng(seed))
			const correct = question.options.find((option) => option.isCorrect)!
			if (correct.visual.kind !== 'grid') throw new Error('三视图答案必须是网格')
			expect(gridSignature(correct.visual.grid)).toBe(
				gridSignature(orthographicView(question.solid, question.viewDirection!)),
			)
			for (const option of question.options) {
				if (option.isCorrect || option.visual.kind !== 'grid') continue
				expect(gridShapeKey(option.visual.grid)).not.toBe(gridShapeKey(correct.visual.grid))
			}
		}
	})

	it('explains cube counts by layers', () => {
		for (let seed = 1; seed <= 60; seed++) {
			const question = generateQ5(seededRng(seed))
			const correct = question.options.find((option) => option.isCorrect)!
			if (correct.visual.kind !== 'value') throw new Error('计数答案必须是数字')
			expect(correct.visual.value).toBe(String(question.solid.voxels.length))
			expect(question.layerCounts!.reduce((sum, count) => sum + count, 0)).toBe(
				question.solid.voxels.length,
			)
			expect(new Set(question.options.map((option) => option.label)).size).toBe(4)
		}
	})

	it('folds each net into exactly three opposite pairs', () => {
		for (let seed = 1; seed <= 60; seed++) {
			const question = generateQ6(seededRng(seed))
			expect(question.questionGrid!.cells).toHaveLength(6)
			expect(question.oppositePairs).toHaveLength(3)
			const valid = new Set(question.oppositePairs!.map((pair) => [...pair].sort().join('-')))
			for (const option of question.options) {
				if (option.visual.kind !== 'faces') throw new Error('展开图选项必须是面对')
				const key = [...option.visual.labels].sort().join('-')
				expect(valid.has(key)).toBe(option.isCorrect)
			}
		}
	})

	it('uses only the true complement shape for assembly questions', () => {
		for (let seed = 1; seed <= 60; seed++) {
			const question = generateQ8(seededRng(seed))
			const correct = question.options.find((option) => option.isCorrect)!
			if (correct.visual.kind !== 'solid') throw new Error('拼合答案必须是立体')
			expect(question.targetSolid!.voxels.length - question.solid.voxels.length).toBe(
				correct.visual.solid.voxels.length,
			)
			for (const option of question.options) {
				if (option.isCorrect || option.visual.kind !== 'solid') continue
				expect(areSolidsCongruent(option.visual.solid, correct.visual.solid)).toBe(false)
			}
		}
	})

	it('accepts only proper rotations and rejects mirror or mutated solids', () => {
		for (let seed = 1; seed <= 60; seed++) {
			const question = generateQ9(seededRng(seed))
			for (const option of question.options) {
				if (option.visual.kind !== 'solid') throw new Error('旋转选项必须是立体')
				expect(areSolidsCongruent(question.solid, option.visual.solid)).toBe(option.isCorrect)
			}
		}
	})
})
