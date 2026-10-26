import { describe, expect, it } from 'bun:test'
import { type QuizKind, generateQ1, generateQ7, generateQuiz } from './toolSectionQuiz'
import { quizVisualKey } from './toolSectionQuizTypes'
import { sectionToSvgPaths } from './toolSectionSvg'
import { computeSection, cutPointsForPlane, planeFromPoints, planeKey } from './toolSectionUtils'

const KINDS: QuizKind[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9']

function seededRng(seed: number) {
	let state = seed
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0
		return state / 0x100000000
	}
}

describe('toolSectionQuiz', () => {
	it('gives all nine kinds four unique drawable options and one correct answer', () => {
		for (const kind of KINDS) {
			for (let seed = 1; seed <= 30; seed++) {
				const question = generateQuiz(kind, seededRng(seed))
				expect(question.options).toHaveLength(4)
				expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1)
				expect(new Set(question.options.map((option) => quizVisualKey(option.visual))).size).toBe(4)
				for (const option of question.options) {
					const visual = option.visual
					expect(option.explanation.length).toBeGreaterThan(0)
					if (visual.kind === 'section') {
						expect(visual.section.patches.length).toBeGreaterThan(0)
						const svg = sectionToSvgPaths(visual.section, visual.diagramPlane, 128)
						expect(svg.paths).toHaveLength(visual.section.patches.length)
						expect(svg.outlines.length).toBeGreaterThan(0)
					} else {
						expect(option.plane).toBeUndefined()
						if (visual.kind === 'grid') expect(visual.grid.cells.length).toBeGreaterThan(0)
						if (visual.kind === 'solid') expect(visual.solid.voxels.length).toBeGreaterThan(0)
						if (visual.kind === 'value') expect(visual.value.length).toBeGreaterThan(0)
						if (visual.kind === 'faces') expect(visual.labels).toHaveLength(2)
					}
					if (!option.plane) continue
					expect(visual.kind).toBe('section')
					if (visual.kind !== 'section') continue
					expect(computeSection(question.solid, option.plane).signature).toBe(
						visual.section.signature,
					)
					const points = cutPointsForPlane(question.solid, option.plane)
					expect(points).not.toBeNull()
					const pointPlane = planeFromPoints(...points!)
					expect(pointPlane).not.toBeNull()
					expect(planeKey(pointPlane!)).toBe(planeKey(option.plane))
				}
			}
		}
	})

	it('always uses three non-collinear vertices that define the Q3 cutting plane', () => {
		for (let seed = 1; seed <= 100; seed++) {
			const question = generateQuiz('Q3', seededRng(seed))
			expect(question.points).toBeDefined()
			const plane = planeFromPoints(...question.points!)
			expect(plane).not.toBeNull()
			expect(planeKey(plane!)).toBe(planeKey(question.correctPlane!))
			expect(question.options.every((option) => option.plane)).toBe(true)
		}
	})

	it('offers real cube sections and varied forbidden shapes', () => {
		const legalLabels = new Set<string>()
		const forbiddenLabels = new Set<string>()
		for (let seed = 1; seed <= 100; seed++) {
			const question = generateQ7(seededRng(seed))
			for (const option of question.options) {
				if (option.visual.kind !== 'section') throw new Error('Q7 选项必须是截面图')
				const section = option.visual.section
				expect(section.patches).toHaveLength(1)
				if (option.isCorrect) {
					expect(option.plane).toBeUndefined()
					forbiddenLabels.add(option.label)
				} else {
					expect(option.plane).toBeDefined()
					legalLabels.add(option.label)
				}
			}
		}
		expect(legalLabels).toEqual(
			new Set(['等边三角形', '斜三角形', '矩形', '梯形', '五边形', '六边形']),
		)
		expect(forbiddenLabels.size).toBeGreaterThan(1)
	})

	it('retains every patch of multipart Q1 options in their SVG projection', () => {
		let multipartOptions = 0
		for (let seed = 1; seed <= 40; seed++) {
			const question = generateQ1(seededRng(seed))
			for (const option of question.options) {
				if (option.visual.kind !== 'section') throw new Error('Q1 选项必须是截面图')
				const { section, diagramPlane } = option.visual
				if (section.patches.length < 2) continue
				multipartOptions++
				const svg = sectionToSvgPaths(section, diagramPlane, 128)
				expect(svg.paths).toHaveLength(section.patches.length)
				expect(svg.outlines.length).toBeGreaterThan(0)
			}
		}
		expect(multipartOptions).toBeGreaterThan(0)
	})
})
