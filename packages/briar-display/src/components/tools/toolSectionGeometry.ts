import * as THREE from 'three'
import { isOccupied } from './toolSectionEditor'
import type { Solid, Vec3, Voxel } from './toolSectionUtils'

const SURFACE_EPSILON = 1e-6

function neighborOf(voxel: Voxel, axis: number, offset: number): Vec3 {
	const cell: [number, number, number] = [voxel.x, voxel.y, voxel.z]
	cell[axis] += offset
	return cell
}

export function isExteriorSurfacePoint(solid: Solid, point: Vec3): boolean {
	return solid.voxels.some((voxel) => {
		const local = [point[0] - voxel.x, point[1] - voxel.y, point[2] - voxel.z]
		if (local.some((value) => value < -SURFACE_EPSILON || value > 1 + SURFACE_EPSILON)) {
			return false
		}
		return local.some((value, axis) => {
			if (Math.abs(value) <= SURFACE_EPSILON) {
				return !isOccupied(solid, neighborOf(voxel, axis, -1))
			}
			if (Math.abs(value - 1) <= SURFACE_EPSILON) {
				return !isOccupied(solid, neighborOf(voxel, axis, 1))
			}
			return false
		})
	})
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
