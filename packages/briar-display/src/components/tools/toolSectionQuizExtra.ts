import {
	type QuizOption,
	type QuizQuestion,
	type QuizVisual,
	assignIds,
	quizVisualKey,
	shuffle,
} from './toolSectionQuizTypes'
import {
	type GridDiagram,
	QUIZ_SOLID_PRESETS,
	type ViewDirection,
	areSolidsCongruent,
	boundingSize,
	cuboid,
	gridSignature,
	isSupportedSolid,
	layerCounts,
	mirrorGrid,
	mirrorSolid,
	orthographicView,
	randomSolidPreset,
	rotateGrid,
	rotateSolid,
	solidKey,
	subtractSolid,
} from './toolSectionSolids'
import { type Solid, type Vec3, solidSingleCube, voxelKey } from './toolSectionUtils'

function makeOption(
	label: string,
	visual: QuizVisual,
	explanation: string,
	isCorrect = false,
): QuizOption {
	return { id: '', label, visual, explanation, isCorrect }
}

function gridOption(grid: GridDiagram, isCorrect: boolean, explanation: string): QuizOption {
	return makeOption('视图轮廓', { kind: 'grid', grid }, explanation, isCorrect)
}

function solidOption(solid: Solid, isCorrect: boolean, explanation: string): QuizOption {
	return makeOption('立体零件', { kind: 'solid', solid }, explanation, isCorrect)
}

const VIEW_LABELS: Record<ViewDirection, string> = {
	front: '正视图（从正面向后看）',
	side: '侧视图（从右面向左看）',
	top: '俯视图（从上向下看）',
}

export function generateQ2(rng: () => number = Math.random): QuizQuestion {
	const solid = randomSolidPreset(rng).solid
	const directions: ViewDirection[] = ['front', 'side', 'top']
	const direction = directions[Math.floor(rng() * directions.length)]
	const correct = orthographicView(solid, direction)
	const correctKey = gridSignature(correct)
	const wrong = new Map<string, GridDiagram>()
	const add = (grid: GridDiagram) => {
		const key = gridSignature(grid)
		if (key !== correctKey) wrong.set(key, grid)
	}
	for (const other of directions) {
		if (other !== direction) add(orthographicView(solid, other))
	}
	let rotated = rotateGrid(correct)
	for (let index = 0; index < 3; index++) {
		add(rotated)
		add(mirrorGrid(rotated))
		rotated = rotateGrid(rotated)
	}
	for (let attempt = 0; attempt < 40 && wrong.size < 3; attempt++) {
		const row = Math.floor(rng() * correct.rows)
		const col = Math.floor(rng() * correct.cols)
		const exists = correct.cells.some((cell) => cell.row === row && cell.col === col)
		add({
			...correct,
			cells: exists
				? correct.cells.filter((cell) => cell.row !== row || cell.col !== col)
				: [...correct.cells, { row, col }],
		})
	}
	const picked = shuffle([...wrong.values()], rng).slice(0, 3)
	const options = assignIds(
		[
			gridOption(correct, true, `${VIEW_LABELS[direction]}，逐行核对遮挡后的占位即可得到该轮廓。`),
			...picked.map((grid) =>
				gridOption(grid, false, '该投影的占位或外轮廓与指定观察方向不一致。'),
			),
		],
		rng,
	)
	return {
		kind: 'Q2',
		prompt: `观察左图立体，它的${VIEW_LABELS[direction]}是哪一项？`,
		solid,
		lockOrbitUntilAnswer: true,
		options,
		viewDirection: direction,
	}
}

export function generateQ5(rng: () => number = Math.random): QuizQuestion {
	const supported = QUIZ_SOLID_PRESETS.filter((preset) => isSupportedSolid(preset.solid))
	const preset = supported[Math.floor(rng() * supported.length)]
	const solid = rotateSolid(preset.solid, Math.floor(rng() * 24))
	const count = solid.voxels.length
	const counts = layerCounts(solid)
	const values = shuffle(
		[count - 3, count - 2, count - 1, count + 1, count + 2, count + 3].filter(
			(value) => value > 0 && value !== count,
		),
		rng,
	).slice(0, 3)
	const options = assignIds(
		[
			makeOption(
				`${count} 块`,
				{ kind: 'value', value: String(count), caption: '小正方体' },
				`从下往上各层依次为 ${counts.join(' + ')}，合计 ${count} 块。`,
				true,
			),
			...values.map((value) =>
				makeOption(
					`${value} 块`,
					{ kind: 'value', value: String(value), caption: '小正方体' },
					`分层计数后总数不是 ${value} 块，注意被遮挡的支撑块。`,
				),
			),
		],
		rng,
	)
	return {
		kind: 'Q5',
		prompt: '左图由相同的小正方体堆成，被遮挡处均有支撑。这个立体一共有多少块？',
		solid,
		lockOrbitUntilAnswer: true,
		options,
		layerCounts: counts,
	}
}

type NetCell = { x: number; y: number }
type Orientation = { u: Vec3; v: Vec3; n: Vec3 }

const NET_LAYOUTS: NetCell[][] = [
	[
		{ x: 0, y: 0 },
		{ x: 0, y: 1 },
		{ x: 0, y: -1 },
		{ x: 0, y: -2 },
		{ x: -1, y: 0 },
		{ x: 1, y: 0 },
	],
	[
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 2, y: 0 },
		{ x: 3, y: 0 },
		{ x: 1, y: 1 },
		{ x: 1, y: -1 },
	],
	[
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 2, y: 0 },
		{ x: 3, y: 0 },
		{ x: 1, y: 1 },
		{ x: 2, y: 1 },
	],
	[
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 2, y: 0 },
		{ x: 1, y: 1 },
		{ x: 2, y: 1 },
		{ x: 3, y: 1 },
	],
	[
		{ x: 0, y: 0 },
		{ x: 0, y: 1 },
		{ x: 1, y: 1 },
		{ x: 1, y: 2 },
		{ x: 2, y: 2 },
		{ x: 2, y: 3 },
	],
]

function turn(orientation: Orientation, dx: number, dy: number): Orientation {
	const { u, v, n } = orientation
	const neg = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]]
	if (dx === 1) return { u: neg(n), v, n: u }
	if (dx === -1) return { u: n, v, n: neg(u) }
	if (dy === 1) return { u, v: neg(n), n: v }
	return { u, v: n, n: neg(v) }
}

function foldNet(layout: NetCell[]): Orientation[] | null {
	const orientations = new Map<string, Orientation>()
	const first = layout[0]
	orientations.set(`${first.x},${first.y}`, { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] })
	const queue = [first]
	for (let index = 0; index < queue.length; index++) {
		const current = queue[index]
		const orientation = orientations.get(`${current.x},${current.y}`)!
		for (const next of layout) {
			const dx = next.x - current.x
			const dy = next.y - current.y
			if (Math.abs(dx) + Math.abs(dy) !== 1) continue
			const key = `${next.x},${next.y}`
			if (orientations.has(key)) continue
			orientations.set(key, turn(orientation, dx, dy))
			queue.push(next)
		}
	}
	if (orientations.size !== 6) return null
	const normals = new Set(
		[...orientations.values()].map(({ n }) => n.map((value) => Math.round(value)).join(',')),
	)
	return normals.size === 6 ? layout.map((cell) => orientations.get(`${cell.x},${cell.y}`)!) : null
}

export function generateQ6(rng: () => number = Math.random): QuizQuestion {
	const valid = NET_LAYOUTS.map((layout) => ({ layout, folded: foldNet(layout) })).filter(
		(entry) => entry.folded !== null,
	)
	const chosen = valid[Math.floor(rng() * valid.length)]
	const labels = shuffle(['A', 'B', 'C', 'D', 'E', 'F'], rng)
	const minX = Math.min(...chosen.layout.map((cell) => cell.x))
	const maxX = Math.max(...chosen.layout.map((cell) => cell.x))
	const maxY = Math.max(...chosen.layout.map((cell) => cell.y))
	const minY = Math.min(...chosen.layout.map((cell) => cell.y))
	const questionGrid: GridDiagram = {
		rows: maxY - minY + 1,
		cols: maxX - minX + 1,
		cells: chosen.layout.map((cell, index) => ({
			row: maxY - cell.y,
			col: cell.x - minX,
			label: labels[index],
			color: 'gray',
		})),
	}
	const pairs: Array<readonly [string, string]> = []
	for (let i = 0; i < labels.length; i++) {
		for (let j = i + 1; j < labels.length; j++) {
			const a = chosen.folded![i].n
			const b = chosen.folded![j].n
			if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] === -1) {
				pairs.push([labels[i], labels[j]])
			}
		}
	}
	const opposite = new Set(pairs.map((pair) => [...pair].sort().join('-')))
	const correct = pairs[Math.floor(rng() * pairs.length)]
	const wrong: Array<readonly [string, string]> = []
	for (let i = 0; i < labels.length; i++) {
		for (let j = i + 1; j < labels.length; j++) {
			const pair = [labels[i], labels[j]] as const
			if (!opposite.has([...pair].sort().join('-'))) wrong.push(pair)
		}
	}
	const pairText = (pair: readonly [string, string]) => pair.join(' ↔ ')
	const options = assignIds(
		[
			makeOption(
				pairText(correct),
				{ kind: 'faces', labels: [...correct] },
				`折叠后三对相对面为 ${pairs.map(pairText).join('、')}。`,
				true,
			),
			...shuffle(wrong, rng)
				.slice(0, 3)
				.map((pair) =>
					makeOption(
						pairText(pair),
						{ kind: 'faces', labels: [...pair] },
						'这两个面折叠后相邻，并非相对面。',
					),
				),
		],
		rng,
	)
	return {
		kind: 'Q6',
		prompt: '左侧是一个正方体展开图。折叠后，哪一组字母所在的面互为相对面？',
		solid: solidSingleCube(),
		lockOrbitUntilAnswer: false,
		options,
		questionGrid,
		oppositePairs: pairs,
	}
}

function isConnected(solid: Solid): boolean {
	if (solid.voxels.length === 0) return false
	const occupied = new Set(solid.voxels.map((voxel) => voxelKey(voxel)))
	const queue = [solid.voxels[0]]
	const visited = new Set<string>()
	for (let index = 0; index < queue.length; index++) {
		const voxel = queue[index]
		visited.add(voxelKey(voxel))
		for (const [dx, dy, dz] of [
			[1, 0, 0],
			[-1, 0, 0],
			[0, 1, 0],
			[0, -1, 0],
			[0, 0, 1],
			[0, 0, -1],
		]) {
			const next = { x: voxel.x + dx, y: voxel.y + dy, z: voxel.z + dz }
			if (occupied.has(voxelKey(next)) && !visited.has(voxelKey(next))) queue.push(next)
		}
	}
	return visited.size === solid.voxels.length
}

function shapeVariants(solid: Solid): Solid[] {
	const variants: Solid[] = []
	const occupied = new Set(solid.voxels.map((voxel) => voxelKey(voxel)))
	const directions = [
		[1, 0, 0],
		[-1, 0, 0],
		[0, 1, 0],
		[0, -1, 0],
		[0, 0, 1],
		[0, 0, -1],
	]
	for (const voxel of solid.voxels) {
		for (const [dx, dy, dz] of directions) {
			const target = { x: voxel.x + dx, y: voxel.y + dy, z: voxel.z + dz }
			if (occupied.has(voxelKey(target))) continue
			variants.push({ voxels: [...solid.voxels, target] })
			const moved = solid.voxels.map((item) => (item === voxel ? { ...item, ...target } : item))
			if (isConnected({ voxels: moved })) variants.push({ voxels: moved })
		}
	}
	for (const voxel of solid.voxels) {
		const removed = solid.voxels.filter((item) => item !== voxel)
		if (removed.length > 0 && isConnected({ voxels: removed })) variants.push({ voxels: removed })
	}
	return variants
}

function wrongShapes(original: Solid, rng: () => number): Solid[] {
	const result: Solid[] = []
	const seen = new Set<string>()
	const add = (solid: Solid) => {
		if (!isConnected(solid) || areSolidsCongruent(original, solid)) return
		const key = solidKey(solid)
		if (seen.has(key)) return
		seen.add(key)
		result.push(solid)
	}
	for (const axis of [0, 1, 2] as const) {
		for (const rotation of [3, 9, 17]) add(rotateSolid(mirrorSolid(original, axis), rotation))
	}
	for (const variant of shuffle(shapeVariants(original), rng)) add(variant)
	for (const preset of shuffle(QUIZ_SOLID_PRESETS, rng)) add(preset.solid)
	return result
}

export function generateQ8(rng: () => number = Math.random): QuizQuestion {
	const pieces = QUIZ_SOLID_PRESETS.filter(
		(preset) => preset.solid.voxels.length >= 4 && preset.solid.voxels.length <= 6,
	)
	const piece = rotateSolid(pieces[Math.floor(rng() * pieces.length)].solid, Math.floor(rng() * 24))
	const size = boundingSize(piece)
	const target = cuboid(size[0] + 1, size[1], size[2])
	const partial = subtractSolid(target, piece)
	const missing = target.voxels.length - partial.voxels.length
	const options = assignIds(
		[
			solidOption(
				piece,
				true,
				`目标共有 ${target.voxels.length} 块，左图已有 ${partial.voxels.length} 块，还缺 ${missing} 块；该零件的凹凸位置也与缺口一致。`,
			),
			...wrongShapes(piece, rng)
				.slice(0, 3)
				.map((solid) =>
					solidOption(solid, false, '该零件的块数或凸出位置与缺口不一致，不能补成目标长方体。'),
				),
		],
		rng,
	)
	return {
		kind: 'Q8',
		prompt: `左图还缺一个零件才能组成 ${size[0] + 1}×${size[1]}×${size[2]} 的长方体，应选择哪一项？`,
		solid: partial,
		lockOrbitUntilAnswer: true,
		options,
		targetSolid: target,
	}
}

export function generateQ9(rng: () => number = Math.random): QuizQuestion {
	const chiral = QUIZ_SOLID_PRESETS.filter(
		(preset) => !areSolidsCongruent(preset.solid, mirrorSolid(preset.solid, 0)),
	)
	const original = rotateSolid(
		chiral[Math.floor(rng() * chiral.length)].solid,
		Math.floor(rng() * 24),
	)
	const correct = rotateSolid(original, 1 + Math.floor(rng() * 23))
	const options = assignIds(
		[
			solidOption(correct, true, '该项与原立体的连接关系和手性一致，可以通过刚体旋转重合。'),
			...wrongShapes(original, rng)
				.slice(0, 3)
				.map((solid) =>
					solidOption(solid, false, '该项存在镜像或连接位置变化，仅旋转无法与原立体重合。'),
				),
		],
		rng,
	)
	return {
		kind: 'Q9',
		prompt: '左图立体经过空间旋转后（不镜像、不增删方块），哪一项可能是同一个立体？',
		solid: original,
		lockOrbitUntilAnswer: true,
		options,
	}
}

export function assertUniqueOptions(question: QuizQuestion): void {
	const keys = new Set(question.options.map((option) => quizVisualKey(option.visual)))
	if (keys.size !== question.options.length) throw new Error(`${question.kind} 存在重复选项`)
}
