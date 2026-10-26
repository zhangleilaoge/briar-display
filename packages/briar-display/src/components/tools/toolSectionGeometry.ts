import * as THREE from 'three'
import type { CutPoints } from './toolSectionEditor'
import {
	CUBE_EDGES,
	type SectionPatch,
	type Solid,
	type Vec3,
	type Voxel,
	voxelKey,
} from './toolSectionUtils'

const SURFACE_EPSILON = 1e-6
const FACE_DIRECTIONS = [0, 1, 2].flatMap((axis) => [
	{ axis, offset: -1 },
	{ axis, offset: 1 },
])

function occupiedCells(solid: Solid): Set<string> {
	return new Set(solid.voxels.map(voxelKey))
}

function neighborKey(voxel: Voxel, axis: number, offset: number): string {
	const cell: [number, number, number] = [voxel.x, voxel.y, voxel.z]
	cell[axis] += offset
	return cell.join(',')
}

export function isExteriorSurfacePoint(solid: Solid, point: Vec3): boolean {
	const occupied = occupiedCells(solid)
	return solid.voxels.some((voxel) => {
		const local = [point[0] - voxel.x, point[1] - voxel.y, point[2] - voxel.z]
		if (local.some((value) => value < -SURFACE_EPSILON || value > 1 + SURFACE_EPSILON)) {
			return false
		}
		return local.some((value, axis) => {
			if (Math.abs(value) <= SURFACE_EPSILON) {
				return !occupied.has(neighborKey(voxel, axis, -1))
			}
			if (Math.abs(value - 1) <= SURFACE_EPSILON) {
				return !occupied.has(neighborKey(voxel, axis, 1))
			}
			return false
		})
	})
}

export function cutPointLabelOffset(solid: Solid, point: Vec3, distance = 0.36): Vec3 {
	const occupied = occupiedCells(solid)
	const normals = new Map<string, { axis: number; offset: number }>()
	for (const voxel of solid.voxels) {
		const local = [point[0] - voxel.x, point[1] - voxel.y, point[2] - voxel.z]
		if (local.some((value) => value < -SURFACE_EPSILON || value > 1 + SURFACE_EPSILON)) {
			continue
		}
		for (const { axis, offset } of FACE_DIRECTIONS) {
			if (occupied.has(neighborKey(voxel, axis, offset))) continue
			const coordinate = local[axis]
			const onFace =
				offset < 0
					? Math.abs(coordinate) <= SURFACE_EPSILON
					: Math.abs(coordinate - 1) <= SURFACE_EPSILON
			if (onFace) normals.set(`${axis},${offset}`, { axis, offset })
		}
	}
	const direction: [number, number, number] = [0, 0, 0]
	for (const { axis, offset } of normals.values()) direction[axis] += offset
	const normal = new THREE.Vector3(...direction)
	if (normal.lengthSq() < SURFACE_EPSILON) normal.set(0, 1, 0)
	return normal.normalize().multiplyScalar(distance).toArray() as Vec3
}

export function nearestExteriorPoint(solid: Solid, point: Vec3): Vec3 | null {
	const occupied = occupiedCells(solid)
	let nearest: { point: Vec3; distance: number } | null = null
	for (const voxel of solid.voxels) {
		for (const { axis, offset } of FACE_DIRECTIONS) {
			if (occupied.has(neighborKey(voxel, axis, offset))) continue
			const candidate: [number, number, number] = [
				THREE.MathUtils.clamp(point[0], voxel.x, voxel.x + 1),
				THREE.MathUtils.clamp(point[1], voxel.y, voxel.y + 1),
				THREE.MathUtils.clamp(point[2], voxel.z, voxel.z + 1),
			]
			candidate[axis] = voxel[axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'] + (offset > 0 ? 1 : 0)
			const distance =
				(point[0] - candidate[0]) ** 2 +
				(point[1] - candidate[1]) ** 2 +
				(point[2] - candidate[2]) ** 2
			if (!nearest || distance < nearest.distance) nearest = { point: candidate, distance }
		}
	}
	return nearest?.point ?? null
}

export function nearestExteriorEdgePoint(solid: Solid, point: Vec3): Vec3 | null {
	const occupied = occupiedCells(solid)
	const target = new THREE.Vector3(...point)
	const candidate = new THREE.Vector3()
	const seen = new Set<string>()
	let nearest: { point: Vec3; distance: number } | null = null
	for (const voxel of solid.voxels) {
		for (const [start, end] of CUBE_EDGES) {
			const edgeAxis = start.findIndex((value, axis) => value !== end[axis])
			const exterior = [0, 1, 2].some((axis) => {
				if (axis === edgeAxis) return false
				const offset = start[axis] === 0 ? -1 : 1
				return !occupied.has(neighborKey(voxel, axis, offset))
			})
			if (!exterior) continue
			const a: Vec3 = [voxel.x + start[0], voxel.y + start[1], voxel.z + start[2]]
			const b: Vec3 = [voxel.x + end[0], voxel.y + end[1], voxel.z + end[2]]
			const key = [a, b]
				.map((vertex) => vertex.join(','))
				.sort()
				.join('|')
			if (seen.has(key)) continue
			seen.add(key)
			new THREE.Line3(new THREE.Vector3(...a), new THREE.Vector3(...b)).closestPointToPoint(
				target,
				true,
				candidate,
			)
			const distance = candidate.distanceToSquared(target)
			if (!nearest || distance < nearest.distance) {
				nearest = { point: candidate.toArray() as Vec3, distance }
			}
		}
	}
	return nearest?.point ?? null
}

export function snapCutPointsToSolid(
	solid: Solid,
	points: CutPoints,
	edgesOnly = false,
): CutPoints {
	if (solid.voxels.length === 0) return points
	let changed = false
	const next = points.map((point) => {
		const snapped = edgesOnly
			? nearestExteriorEdgePoint(solid, point)
			: nearestExteriorPoint(solid, point)
		if (!snapped || snapped.every((value, index) => Math.abs(value - point[index]) < 1e-9)) {
			return point
		}
		changed = true
		return snapped
	}) as CutPoints
	return changed ? next : points
}

function rayBoxPoints(ray: THREE.Ray, voxel: Voxel): THREE.Vector3[] {
	const min = [voxel.x, voxel.y, voxel.z]
	const max = [voxel.x + 1, voxel.y + 1, voxel.z + 1]
	const origin = ray.origin.toArray()
	const direction = ray.direction.toArray()
	let near = Number.NEGATIVE_INFINITY
	let far = Number.POSITIVE_INFINITY

	for (let axis = 0; axis < 3; axis++) {
		if (Math.abs(direction[axis]) < 1e-12) {
			if (origin[axis] < min[axis] || origin[axis] > max[axis]) return []
			continue
		}
		const inverse = 1 / direction[axis]
		let first = (min[axis] - origin[axis]) * inverse
		let second = (max[axis] - origin[axis]) * inverse
		if (first > second) [first, second] = [second, first]
		near = Math.max(near, first)
		far = Math.min(far, second)
		if (near > far) return []
	}

	const distances = near >= 0 ? [near, far] : far >= 0 ? [far] : []
	return distances.map((distance) => ray.at(distance, new THREE.Vector3()))
}

export function raycastSolidSurface(
	solid: Solid,
	ray: THREE.Ray,
	target?: THREE.Vector3,
): Vec3 | null {
	let nearest: { point: THREE.Vector3; distance: number } | null = null
	for (const voxel of solid.voxels) {
		for (const point of rayBoxPoints(ray, voxel)) {
			const local = point.toArray() as Vec3
			if (!isExteriorSurfacePoint(solid, local)) continue
			const distance = target
				? point.distanceToSquared(target)
				: point.distanceToSquared(ray.origin)
			if (!nearest || distance < nearest.distance) nearest = { point, distance }
		}
	}
	return nearest ? (nearest.point.toArray() as Vec3) : null
}

export function exposedSectionBoundaries(
	solid: Solid,
	patch: SectionPatch,
): Array<{ points: [Vec3, Vec3]; normal: Vec3 }> {
	if (patch.points.length < 3) return []
	const occupied = occupiedCells(solid)
	return patch.points.flatMap((start, index) => {
		const end = patch.points[(index + 1) % patch.points.length]
		const outward: [number, number, number] = [0, 0, 0]
		let exposed = false
		for (const { axis, offset } of FACE_DIRECTIONS) {
			if (occupied.has(neighborKey(patch.voxel, axis, offset))) continue
			const coordinate =
				patch.voxel[axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'] + (offset > 0 ? 1 : 0)
			if (
				Math.abs(start[axis] - coordinate) > SURFACE_EPSILON ||
				Math.abs(end[axis] - coordinate) > SURFACE_EPSILON
			) {
				continue
			}
			exposed = true
			outward[axis] += offset
		}
		if (!exposed) return []
		return [
			{
				points: [start, end],
				normal: new THREE.Vector3(...outward).normalize().toArray() as Vec3,
			},
		]
	})
}
