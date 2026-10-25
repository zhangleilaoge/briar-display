import { type Solid, type Vec3, type Voxel, voxelKey } from './toolSectionUtils'

export type CutPoints = [Vec3, Vec3, Vec3]
export type VoxelEditError = 'invalid' | 'missing' | 'occupied'
export type VoxelEditResult = {
	solid: Solid
	error: VoxelEditError | null
}

const NEIGHBOR_DIRECTIONS: Vec3[] = [
	[1, 0, 0],
	[-1, 0, 0],
	[0, 1, 0],
	[0, -1, 0],
	[0, 0, 1],
	[0, 0, -1],
]

function isCell(cell: Vec3): boolean {
	return cell.every((value) => Number.isInteger(value))
}

export function cellFromCenter(point: Vec3): Vec3 {
	return [Math.round(point[0] - 0.5), Math.round(point[1] - 0.5), Math.round(point[2] - 0.5)]
}

export function isOccupied(solid: Solid, cell: Vec3, ignore?: Vec3): boolean {
	const key = voxelKey({ x: cell[0], y: cell[1], z: cell[2] })
	const ignoreKey = ignore ? voxelKey({ x: ignore[0], y: ignore[1], z: ignore[2] }) : null
	return solid.voxels.some((voxel) => voxelKey(voxel) === key && voxelKey(voxel) !== ignoreKey)
}

export function defaultCutPoints(solid: Solid): CutPoints {
	if (solid.voxels.length === 0) {
		return [
			[0, 0, 0],
			[1, 0, 1],
			[0, 1, 0],
		]
	}
	const xs = solid.voxels.map((voxel) => voxel.x)
	const ys = solid.voxels.map((voxel) => voxel.y)
	const zs = solid.voxels.map((voxel) => voxel.z)
	const minX = Math.min(...xs)
	const minY = Math.min(...ys)
	const minZ = Math.min(...zs)
	return [
		[minX, minY, minZ],
		[Math.max(...xs) + 1, minY, Math.max(...zs) + 1],
		[minX, Math.max(...ys) + 1, minZ],
	]
}

export function additionCells(solid: Solid, selectedCell: Vec3 | null | undefined): Vec3[] {
	if (!selectedCell) return []
	const selected = solid.voxels.find(
		(voxel) =>
			voxel.x === selectedCell[0] && voxel.y === selectedCell[1] && voxel.z === selectedCell[2],
	)
	if (!selected) return []
	return NEIGHBOR_DIRECTIONS.map(
		(direction): Vec3 => [
			selected.x + direction[0],
			selected.y + direction[1],
			selected.z + direction[2],
		],
	).filter((cell) => !isOccupied(solid, cell))
}

export function addVoxel(solid: Solid, cell: Vec3): VoxelEditResult {
	if (!isCell(cell)) return { solid, error: 'invalid' }
	if (isOccupied(solid, cell)) return { solid, error: 'occupied' }
	return {
		solid: {
			voxels: [...solid.voxels, { x: cell[0], y: cell[1], z: cell[2], color: 'white' }],
		},
		error: null,
	}
}

export function removeVoxel(solid: Solid, cell: Vec3): Solid {
	const key = voxelKey({ x: cell[0], y: cell[1], z: cell[2] })
	return { voxels: solid.voxels.filter((voxel) => voxelKey(voxel) !== key) }
}

export function moveVoxel(solid: Solid, from: Vec3, to: Vec3): VoxelEditResult {
	if (!isCell(from) || !isCell(to)) return { solid, error: 'invalid' }
	const fromKey = voxelKey({ x: from[0], y: from[1], z: from[2] })
	if (!solid.voxels.some((voxel) => voxelKey(voxel) === fromKey)) {
		return { solid, error: 'missing' }
	}
	if (isOccupied(solid, to, from)) return { solid, error: 'occupied' }
	return {
		solid: {
			voxels: solid.voxels.map((voxel): Voxel => {
				if (voxelKey(voxel) !== fromKey) return voxel
				return { ...voxel, x: to[0], y: to[1], z: to[2] }
			}),
		},
		error: null,
	}
}
