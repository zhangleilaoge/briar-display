import { type Solid, type Vec3, type Voxel, type VoxelColor, voxelKey } from './toolSectionUtils'

export type SolidPreviewPoint = [number, number]
export type SolidPreviewFace = {
	points: SolidPreviewPoint[]
	color: VoxelColor
	role: 'x' | 'y' | 'z'
	normal: Vec3
}

type Face = Omit<SolidPreviewFace, 'points'> & { points: Vec3[]; depth: number }

export const DEFAULT_SOLID_VIEW: Vec3 = [1, 1, 1]

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0],
]

function normalize(vector: Vec3): Vec3 | null {
	const length = Math.hypot(...vector)
	if (length < 1e-9) return null
	return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function faceCandidates(voxel: Voxel, color: VoxelColor): Array<Omit<Face, 'depth'>> {
	const { x, y, z } = voxel
	return [
		{
			role: 'x',
			normal: [1, 0, 0],
			color,
			points: [
				[x + 1, y, z],
				[x + 1, y + 1, z],
				[x + 1, y + 1, z + 1],
				[x + 1, y, z + 1],
			],
		},
		{
			role: 'x',
			normal: [-1, 0, 0],
			color,
			points: [
				[x, y, z + 1],
				[x, y + 1, z + 1],
				[x, y + 1, z],
				[x, y, z],
			],
		},
		{
			role: 'y',
			normal: [0, 1, 0],
			color,
			points: [
				[x, y + 1, z],
				[x, y + 1, z + 1],
				[x + 1, y + 1, z + 1],
				[x + 1, y + 1, z],
			],
		},
		{
			role: 'y',
			normal: [0, -1, 0],
			color,
			points: [
				[x, y, z + 1],
				[x, y, z],
				[x + 1, y, z],
				[x + 1, y, z + 1],
			],
		},
		{
			role: 'z',
			normal: [0, 0, 1],
			color,
			points: [
				[x, y, z + 1],
				[x, y + 1, z + 1],
				[x + 1, y + 1, z + 1],
				[x + 1, y, z + 1],
			],
		},
		{
			role: 'z',
			normal: [0, 0, -1],
			color,
			points: [
				[x + 1, y, z],
				[x + 1, y + 1, z],
				[x, y + 1, z],
				[x, y, z],
			],
		},
	]
}

export function solidPreviewFaces(
	solid: Solid,
	viewDirection: Vec3 = DEFAULT_SOLID_VIEW,
): SolidPreviewFace[] {
	const direction = normalize(viewDirection) ?? normalize(DEFAULT_SOLID_VIEW)!
	const right = normalize(cross([0, 1, 0], direction)) ?? [1, 0, 0]
	const up = normalize(cross(direction, right))!
	const project = (point: Vec3): SolidPreviewPoint => [dot(point, right), -dot(point, up)]
	const occupied = new Set(solid.voxels.map((voxel) => voxelKey(voxel)))
	const faces: Face[] = []
	for (const voxel of solid.voxels) {
		const candidates = faceCandidates(voxel, voxel.color ?? 'white')
		for (const face of candidates) {
			const neighbor = {
				x: voxel.x + face.normal[0],
				y: voxel.y + face.normal[1],
				z: voxel.z + face.normal[2],
			}
			if (occupied.has(voxelKey(neighbor)) || dot(face.normal, direction) <= 1e-9) continue
			const depth =
				face.points.reduce((sum, point) => sum + dot(point, direction), 0) / face.points.length
			faces.push({ ...face, depth })
		}
	}
	return faces
		.sort((a, b) => a.depth - b.depth)
		.map(({ depth: _depth, ...face }) => ({ ...face, points: face.points.map(project) }))
}
