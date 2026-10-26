import { type GridDiagram, type ViewDirection, gridSignature, solidKey } from './toolSectionSolids'
import type { Plane, Section, Solid, Vec3 } from './toolSectionUtils'

export type QuizKind = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'Q8' | 'Q9'

export type QuizVisual =
	| { kind: 'section'; section: Section; diagramPlane: Plane }
	| { kind: 'grid'; grid: GridDiagram }
	| { kind: 'solid'; solid: Solid }
	| { kind: 'value'; value: string; caption?: string }
	| { kind: 'faces'; labels: [string, string] }

export type QuizOption = {
	id: string
	label: string
	visual: QuizVisual
	/** 在原立体中实现该截面的平面；纯二维干扰项和非截面题没有此字段。 */
	plane?: Plane
	shapeClass?: string
	explanation: string
	isCorrect: boolean
}

export type QuizQuestion = {
	kind: QuizKind
	prompt: string
	solid: Solid
	points?: [Vec3, Vec3, Vec3]
	options: QuizOption[]
	correctSection?: Section
	correctPlane?: Plane
	questionGrid?: GridDiagram
	viewDirection?: ViewDirection
	targetSolid?: Solid
	layerCounts?: number[]
	oppositePairs?: Array<readonly [string, string]>
}

export const QUIZ_OPTION_COUNT = 4
const OPTION_IDS = ['A', 'B', 'C', 'D']

export function shuffle<T>(items: T[], rng: () => number): T[] {
	const result = [...items]
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		;[result[i], result[j]] = [result[j], result[i]]
	}
	return result
}

export function assignIds(options: QuizOption[], rng: () => number): QuizOption[] {
	return shuffle(options, rng).map((option, index) => ({ ...option, id: OPTION_IDS[index] }))
}

export function quizVisualKey(visual: QuizVisual): string {
	switch (visual.kind) {
		case 'section':
			return `section:${visual.section.signature}`
		case 'grid':
			return `grid:${gridSignature(visual.grid)}`
		case 'solid':
			return `solid:${solidKey(visual.solid)}`
		case 'value':
			return `value:${visual.value}`
		case 'faces':
			return `faces:${[...visual.labels].sort().join('-')}`
	}
}
