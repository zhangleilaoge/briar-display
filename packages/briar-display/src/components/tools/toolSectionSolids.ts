import { type Solid, type Vec3, type Voxel, voxelKey } from './toolSectionUtils'

export type Matrix3 = [Vec3, Vec3, Vec3]
export type ViewDirection = 'front' | 'side' | 'top'
export type GridCell = {
	row: number
	col: number
	label?: string
	color?: 'white' | 'gray'
}
export type GridDiagram = { rows: number; cols: number; cells: GridCell[] }
export type SolidPreset = { id: string; name: string; solid: Solid }

function cells(values: Array<readonly [number, number, number]>): Solid {
	return {
		voxels: values.map(([x, y, z]) => ({ x, y, z })),
	}
}

export function normalizeSolid(solid: Solid): Solid {
	if (solid.voxels.length === 0) return { voxels: [] }
	const xs = solid.voxels.map((voxel) => voxel.x)
	const ys = solid.voxels.map((voxel) => voxel.y)
	const zs = solid.voxels.map((voxel) => voxel.z)
	const min = [Math.min(...xs), Math.min(...ys), Math.min(...zs)]
	const unique = new Map<string, Voxel>()
	for (const voxel of solid.voxels) {
		const next = { ...voxel, x: voxel.x - min[0], y: voxel.y - min[1], z: voxel.z - min[2] }
		unique.set(voxelKey(next), next)
	}
	return {
		voxels: [...unique.values()].sort(
			(a, b) => a.x - b.x || a.y - b.y || a.z - b.z || a.color?.localeCompare(b.color ?? '') || 0,
		),
	}
}

export function solidKey(solid: Solid): string {
	return normalizeSolid(solid)
		.voxels.map((voxel) => voxelKey(voxel))
		.join('|')
}

export function transformSolid(solid: Solid, matrix: Matrix3): Solid {
	return normalizeSolid({
		voxels: solid.voxels.map((voxel) => {
			const source = [voxel.x, voxel.y, voxel.z] as const
			const transformed = matrix.map((row) =>
				row.reduce((sum, value, index) => sum + value * source[index], 0),
			)
			return { ...voxel, x: transformed[0], y: transformed[1], z: transformed[2] }
		}),
	})
}

const PERMUTATIONS: Array<[number, number, number]> = [
	[0, 1, 2],
	[0, 2, 1],
	[1, 0, 2],
	[1, 2, 0],
	[2, 0, 1],
	[2, 1, 0],
]

function permutationSign(permutation: [number, number, number]): number {
	let inversions = 0
	for (let i = 0; i < 3; i++) {
		for (let j = i + 1; j < 3; j++) {
			if (permutation[i] > permutation[j]) inversions++
		}
	}
	return inversions % 2 === 0 ? 1 : -1
}

export const ROTATION_MATRICES: Matrix3[] = PERMUTATIONS.flatMap((permutation) => {
	const sign = permutationSign(permutation)
	const matrices: Matrix3[] = []
	for (const x of [-1, 1]) {
		for (const y of [-1, 1]) {
			for (const z of [-1, 1]) {
				if (x * y * z * sign !== 1) continue
				const signs = [x, y, z]
				matrices.push(
					permutation.map((source, row) => {
						const value = signs[row]
						const values: Vec3 = [
							source === 0 ? value : 0,
							source === 1 ? value : 0,
							source === 2 ? value : 0,
						]
						return values
					}) as Matrix3,
				)
			}
		}
	}
	return matrices
})

export function rotateSolid(solid: Solid, index: number): Solid {
	return transformSolid(solid, ROTATION_MATRICES[((index % 24) + 24) % 24])
}

export function mirrorSolid(solid: Solid, axis: 0 | 1 | 2): Solid {
	return normalizeSolid({
		voxels: solid.voxels.map((voxel) => {
			const position = [voxel.x, voxel.y, voxel.z]
			position[axis] = -position[axis]
			return { ...voxel, x: position[0], y: position[1], z: position[2] }
		}),
	})
}

export function congruentKey(solid: Solid): string {
	return ROTATION_MATRICES.map((matrix) => solidKey(transformSolid(solid, matrix))).sort()[0]
}

export function areSolidsCongruent(a: Solid, b: Solid): boolean {
	return a.voxels.length === b.voxels.length && congruentKey(a) === congruentKey(b)
}

export function boundingSize(solid: Solid): Vec3 {
	if (solid.voxels.length === 0) return [0, 0, 0]
	const { voxels } = normalizeSolid(solid)
	return [
		Math.max(...voxels.map((voxel) => voxel.x)) + 1,
		Math.max(...voxels.map((voxel) => voxel.y)) + 1,
		Math.max(...voxels.map((voxel) => voxel.z)) + 1,
	]
}

export function cuboid(width: number, height: number, depth: number): Solid {
	const voxels: Voxel[] = []
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height; y++) {
			for (let z = 0; z < depth; z++) voxels.push({ x, y, z })
		}
	}
	return { voxels }
}

export function subtractSolid(target: Solid, removed: Solid): Solid {
	const keys = new Set(removed.voxels.map((voxel) => voxelKey(voxel)))
	return { voxels: target.voxels.filter((voxel) => !keys.has(voxelKey(voxel))) }
}

export function isSupportedSolid(solid: Solid): boolean {
	const occupied = new Set(solid.voxels.map((voxel) => voxelKey(voxel)))
	return solid.voxels.every(
		(voxel) => voxel.y === 0 || occupied.has(voxelKey({ x: voxel.x, y: voxel.y - 1, z: voxel.z })),
	)
}

export function layerCounts(solid: Solid): number[] {
	const counts = new Map<number, number>()
	for (const voxel of solid.voxels) counts.set(voxel.y, (counts.get(voxel.y) ?? 0) + 1)
	return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([, count]) => count)
}

export function gridSignature(grid: GridDiagram): string {
	const cells = [...grid.cells]
		.sort((a, b) => a.row - b.row || a.col - b.col)
		.map((cell) => `${cell.row},${cell.col},${cell.label ?? ''},${cell.color ?? ''}`)
		.join('|')
	return `${grid.rows}x${grid.cols}:${cells}`
}

export function orthographicView(solid: Solid, direction: ViewDirection): GridDiagram {
	const size = boundingSize(solid)
	const rows = direction === 'top' ? size[2] : size[1]
	const cols = direction === 'side' ? size[2] : size[0]
	const occupied = new Map<string, GridCell>()
	for (const voxel of solid.voxels) {
		const row = direction === 'top' ? size[2] - voxel.z - 1 : size[1] - voxel.y - 1
		const col = direction === 'side' ? size[2] - voxel.z - 1 : voxel.x
		const key = `${row},${col}`
		if (!occupied.has(key)) occupied.set(key, { row, col })
	}
	return { rows, cols, cells: [...occupied.values()] }
}

export function rotateGrid(grid: GridDiagram): GridDiagram {
	return {
		rows: grid.cols,
		cols: grid.rows,
		cells: grid.cells.map((cell) => ({ ...cell, row: cell.col, col: grid.rows - cell.row - 1 })),
	}
}

export function mirrorGrid(grid: GridDiagram): GridDiagram {
	return {
		...grid,
		cells: grid.cells.map((cell) => ({ ...cell, col: grid.cols - cell.col - 1 })),
	}
}

export const QUIZ_SOLID_PRESETS: SolidPreset[] = [
	{
		id: 'l-corner',
		name: '三向转角',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
		]),
	},
	{
		id: 'stair-3',
		name: '三级阶梯',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[1, 0, 1],
			[2, 0, 1],
			[2, 0, 2],
		]),
	},
	{
		id: 'zigzag-6',
		name: '折线塔',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[1, 1, 0],
			[1, 1, 1],
			[2, 1, 1],
			[2, 2, 1],
		]),
	},
	{
		id: 't-5',
		name: 'T 形支架',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[2, 0, 0],
			[1, 1, 0],
			[1, 2, 0],
		]),
	},
	{
		id: 'u-7',
		name: 'U 形槽',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[2, 0, 0],
			[0, 1, 0],
			[2, 1, 0],
			[0, 2, 0],
			[2, 2, 0],
		]),
	},
	{
		id: 'tower-6',
		name: '偏心塔',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[0, 0, 1],
			[1, 0, 1],
			[0, 1, 0],
			[0, 2, 0],
		]),
	},
	{
		id: 'frame-8',
		name: '单层方框',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[2, 0, 0],
			[0, 0, 1],
			[2, 0, 1],
			[0, 0, 2],
			[1, 0, 2],
			[2, 0, 2],
		]),
	},
	{
		id: 'cross-6',
		name: '双层十字',
		solid: cells([
			[1, 0, 0],
			[0, 0, 1],
			[1, 0, 1],
			[2, 0, 1],
			[1, 0, 2],
			[1, 1, 1],
		]),
	},
	{
		id: 'slab-8',
		name: '双层方块',
		solid: cuboid(2, 2, 2),
	},
	{
		id: 'terrace-9',
		name: '三级平台',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[2, 0, 0],
			[0, 0, 1],
			[1, 0, 1],
			[2, 0, 1],
			[0, 1, 0],
			[1, 1, 0],
			[0, 2, 0],
		]),
	},
	{
		id: 'hook-7',
		name: '厚钩体',
		solid: cells([
			[0, 0, 0],
			[1, 0, 0],
			[2, 0, 0],
			[2, 1, 0],
			[2, 1, 1],
			[2, 2, 1],
			[1, 2, 1],
		]),
	},
	{
		id: 'chair-8',
		name: '双层折椅',
		solid: cells([
			[0, 0, 0],
			[0, 0, 1],
			[1, 0, 1],
			[0, 1, 0],
			[0, 1, 1],
			[1, 1, 1],
			[0, 2, 1],
			[1, 2, 1],
		]),
	},
]

export function randomSolidPreset(rng: () => number = Math.random): SolidPreset {
	const preset = QUIZ_SOLID_PRESETS[Math.floor(rng() * QUIZ_SOLID_PRESETS.length)]
	return { ...preset, solid: rotateSolid(preset.solid, Math.floor(rng() * 24)) }
}
