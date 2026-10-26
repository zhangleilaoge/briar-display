import {
	assertUniqueOptions,
	generateQ2,
	generateQ5,
	generateQ6,
	generateQ8,
	generateQ9,
} from './toolSectionQuizExtra'
import {
	type QuizKind,
	type QuizOption,
	type QuizQuestion,
	assignIds,
	shuffle,
} from './toolSectionQuizTypes'
import { randomSolidPreset } from './toolSectionSolids'
import {
	type Plane,
	type Section,
	type SectionPatch,
	type Vec3,
	computeSection,
	cutPointsForPlane,
	enumeratePlanes,
	planeKey,
	shapeClassSignature,
	solidSingleCube,
	solidWithColors,
	vecCross,
	vecNorm,
	vecSub,
	voxelKey,
} from './toolSectionUtils'

export type { QuizKind, QuizOption, QuizQuestion, QuizVisual } from './toolSectionQuizTypes'

type Point2 = readonly [number, number]

const DIAGRAM_PLANE: Plane = { point: [0, 0, 0], normal: [0, 0, 1] }

function diagramSection(polygons: Point2[][]): Section {
	const patches: SectionPatch[] = polygons.map((polygon, index) => {
		const points = polygon.map(([x, y]) => [x, y, 0] as Vec3)
		return { points, color: 'white', voxel: { x: index, y: 0, z: 0 } }
	})
	return {
		patches,
		loops: patches.map((patch) => ({ points: patch.points })),
		edgeCount: Math.max(...patches.map((patch) => patch.points.length)),
		signature: `diagram:${polygons.map((polygon) => polygon.length).join(',')}`,
	}
}

function regularPolygonSection(sides: number): Section {
	return diagramSection([
		Array.from({ length: sides }, (_, index) => {
			const angle = Math.PI / 2 + (index * Math.PI * 2) / sides
			return [Math.cos(angle), Math.sin(angle)] as const
		}),
	])
}

function houseSection(): Section {
	return diagramSection([
		[
			[-0.8, -0.7],
			[0.8, -0.7],
			[0.8, 0.1],
			[0, 0.9],
			[-0.8, 0.1],
		],
	])
}

function separatedTrianglesSection(): Section {
	return diagramSection([
		[
			[-1.8, -0.6],
			[-0.4, -0.6],
			[-1.1, 0.7],
		],
		[
			[0.4, -0.6],
			[1.8, -0.6],
			[1.1, 0.7],
		],
	])
}

function projectedPolygon(section: Section): Point2[] {
	const points = section.patches[0]?.points ?? []
	if (points.length < 3) return []
	const normal = vecNorm(vecCross(vecSub(points[1], points[0]), vecSub(points[2], points[0])))
	const temporary: Vec3 = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
	const u = vecNorm(vecCross(normal, temporary))
	const v = vecNorm(vecCross(normal, u))
	return points.map((point) => [
		point[0] * u[0] + point[1] * u[1] + point[2] * u[2],
		point[0] * v[0] + point[1] * v[1] + point[2] * v[2],
	])
}

function describeShape(section: Section): string {
	if (section.patches.length === 1) {
		const count = section.patches[0].points.length
		const polygon = projectedPolygon(section)
		let convex = polygon.length >= 3
		let sign = 0
		for (let index = 0; index < polygon.length && convex; index++) {
			const a = polygon[index]
			const b = polygon[(index + 1) % polygon.length]
			const c = polygon[(index + 2) % polygon.length]
			const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
			if (Math.abs(cross) < 1e-8) continue
			const nextSign = Math.sign(cross)
			if (sign && sign !== nextSign) convex = false
			sign = nextSign
		}
		return `${convex ? '凸' : '凹'}${count}边形`
	}
	const parts = section.patches.map((patch) => `${patch.points.length}边`).join('+')
	return `${section.patches.length} 块（${parts}）`
}

function realOption(section: Section, plane: Plane, isCorrect = false): QuizOption {
	return {
		id: '',
		label: describeShape(section),
		visual: { kind: 'section', section, diagramPlane: plane },
		plane,
		shapeClass: shapeClassSignature(section),
		explanation: '该截面可在原立体中实现，左侧同步显示其 ABC 与空间位置。',
		isCorrect,
	}
}

function diagramOption(section: Section, label: string, shapeClass: string): QuizOption {
	return {
		id: '',
		label,
		visual: { kind: 'section', section, diagramPlane: DIAGRAM_PLANE },
		shapeClass,
		explanation: '该形状不能在原立体中切出，没有对应的真实切割平面。',
		isCorrect: true,
	}
}

/** Q7：单立方经典禁形。 */
export function generateQ7(rng: () => number = Math.random): QuizQuestion {
	const solid = solidSingleCube()
	const cases: Array<{ label: string; plane: Plane }> = [
		{ label: '等边三角形', plane: { point: [1, 0, 0], normal: [1, 1, 1] } },
		{ label: '斜三角形', plane: { point: [0.5, 0, 0], normal: [1, 1, 2] } },
		{ label: '矩形', plane: { point: [0, 0, 0.5], normal: [0, 0, 1] } },
		{ label: '梯形', plane: { point: [1, 0.5, 0], normal: [1, 2, 2] } },
		{ label: '五边形', plane: { point: [0.5, 1, 0], normal: [1, 1, 2] } },
		{ label: '六边形', plane: { point: [0.75, 0.75, 0], normal: [1, 1, 1] } },
	]
	const legal = cases.map(({ label, plane }) => ({
		...realOption(computeSection(solid, plane), plane),
		label,
	}))
	const impossible = shuffle(
		[
			{ section: regularPolygonSection(7), label: '正七边形' },
			{ section: regularPolygonSection(9), label: '正九边形' },
			{ section: regularPolygonSection(32), label: '圆形（椭圆）' },
		],
		rng,
	)[0]
	const options = assignIds(
		[
			...shuffle(legal, rng).slice(0, 3),
			diagramOption(impossible.section, impossible.label, shapeClassSignature(impossible.section)),
		],
		rng,
	)
	return {
		kind: 'Q7',
		prompt: '将一个正方体用平面任意剖开，下面哪一种不可能是它的截面？',
		solid,
		options,
		correctSection: impossible.section,
	}
}

/** Q1：任意剖开 · 不可能截面（复合体）。 */
export function generateQ1(rng: () => number = Math.random): QuizQuestion {
	const solid = randomSolidPreset(rng).solid
	const examples = new Map<string, { plane: Plane; section: Section }>()
	for (const plane of enumeratePlanes(solid, 500)) {
		const section = computeSection(solid, plane)
		const shapeClass = shapeClassSignature(section)
		if (!examples.has(shapeClass)) examples.set(shapeClass, { plane, section })
	}
	const legalClasses = new Set(examples.keys())
	const picked = shuffle([...examples.entries()], rng).slice(0, 3)
	const impossibleChoice = shuffle(
		[
			{ section: houseSection(), label: '凸五边形（屋顶形）' },
			{ section: separatedTrianglesSection(), label: '两个分离的三角形' },
			{ section: regularPolygonSection(9), label: '九边形' },
			{ section: regularPolygonSection(32), label: '圆形（椭圆）' },
		],
		rng,
	).find(({ section }) => !legalClasses.has(shapeClassSignature(section)))!
	const impossible = diagramOption(
		impossibleChoice.section,
		impossibleChoice.label,
		shapeClassSignature(impossibleChoice.section),
	)
	const options = assignIds(
		[...picked.map(([, { section, plane }]) => realOption(section, plane)), impossible],
		rng,
	)
	return {
		kind: 'Q1',
		prompt: `左图由 ${solid.voxels.length} 个相同正方体组成。将其从任一平面剖开，下面哪一项不可能是该立体的截面？`,
		solid,
		options,
		correctSection: impossibleChoice.section,
	}
}

/** Q4：可见切面选轮廓。 */
export function generateQ4(rng: () => number = Math.random): QuizQuestion {
	const solid = randomSolidPreset(rng).solid
	const candidates = enumeratePlanes(solid, 400).map((plane) => ({
		plane,
		section: computeSection(solid, plane),
	}))
	const chosen = candidates[Math.floor(rng() * candidates.length)]
	const correctClass = shapeClassSignature(chosen.section)
	const alternatives = new Map<string, (typeof candidates)[number]>()
	for (const candidate of shuffle(candidates, rng)) {
		const shapeClass = shapeClassSignature(candidate.section)
		if (shapeClass !== correctClass && !alternatives.has(shapeClass)) {
			alternatives.set(shapeClass, candidate)
		}
	}
	const options = assignIds(
		[
			realOption(chosen.section, chosen.plane, true),
			...[...alternatives.values()]
				.slice(0, 3)
				.map(({ section, plane }) => realOption(section, plane)),
		],
		rng,
	)
	return {
		kind: 'Q4',
		prompt: '观察左图立体，若沿图示方向剖开，正确的截面轮廓是？',
		solid,
		options,
		correctSection: chosen.section,
		correctPlane: chosen.plane,
	}
}

/** Q3：过 ABC 三点的黑白着色截面。 */
export function generateQ3(rng: () => number = Math.random): QuizQuestion {
	const base = randomSolidPreset(rng).solid
	const grayCount = 1 + Math.floor(rng() * (base.voxels.length - 1))
	const grayKeys = shuffle(base.voxels, rng)
		.slice(0, grayCount)
		.map((voxel) => voxelKey(voxel))
	const solid = solidWithColors(base, grayKeys)
	const candidates = enumeratePlanes(solid, 300).map((plane) => ({
		plane,
		section: computeSection(solid, plane),
	}))
	const colored = candidates.filter(({ section }) =>
		section.patches.some((patch) => patch.color === 'gray'),
	)
	const pool = colored.length > 0 ? colored : candidates
	const chosen = pool[Math.floor(rng() * pool.length)]
	const points = cutPointsForPlane(solid, chosen.plane)
	if (
		!points ||
		planeKey({
			point: points[0],
			normal: vecCross(vecSub(points[1], points[0]), vecSub(points[2], points[0])),
		}) !== planeKey(chosen.plane)
	) {
		throw new Error('无法为着色题生成三个有效的切割点')
	}
	const seen = new Set([chosen.section.signature])
	const wrong: QuizOption[] = []
	for (const candidate of shuffle(candidates, rng)) {
		if (seen.has(candidate.section.signature)) continue
		seen.add(candidate.section.signature)
		wrong.push({ ...realOption(candidate.section, candidate.plane), label: '着色截面' })
		if (wrong.length === 3) break
	}
	const options = assignIds(
		[{ ...realOption(chosen.section, chosen.plane, true), label: '着色截面' }, ...wrong],
		rng,
	)
	return {
		kind: 'Q3',
		prompt: '左图立体由白色与黑色小正方体组成。过顶点 A、B、C 的平面剖开后，正确的截面是？',
		solid,
		points,
		options,
		correctSection: chosen.section,
		correctPlane: chosen.plane,
	}
}

const GENERATORS: Record<QuizKind, (rng: () => number) => QuizQuestion> = {
	Q1: generateQ1,
	Q2: generateQ2,
	Q3: generateQ3,
	Q4: generateQ4,
	Q5: generateQ5,
	Q6: generateQ6,
	Q7: generateQ7,
	Q8: generateQ8,
	Q9: generateQ9,
}

export function generateQuiz(kind: QuizKind, rng: () => number = Math.random): QuizQuestion {
	const question = GENERATORS[kind](rng)
	assertUniqueOptions(question)
	return question
}
