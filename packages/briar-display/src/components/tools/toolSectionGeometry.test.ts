import { describe, expect, it } from 'bun:test'
import * as THREE from 'three'
import { type CutPoints, addVoxel, removeVoxel } from './toolSectionEditor'
import {
	cutPointLabelOffset,
	exposedSectionBoundaries,
	isExteriorSurfacePoint,
	nearestExteriorEdgePoint,
	nearestExteriorPoint,
	raycastSolidSurface,
	snapCutPointsToSolid,
} from './toolSectionGeometry'
import {
	computeSection,
	planeFromPoints,
	solidLTetromino,
	solidSingleCube,
} from './toolSectionUtils'

describe('toolSectionGeometry', () => {
	it('keeps dashed section boundaries on exposed faces with outward normals', () => {
		const plane = planeFromPoints([0, 0, 0.5], [1, 0, 0.5], [0, 1, 0.5])!
		const cube = solidSingleCube()
		const cubeSection = computeSection(cube, plane)
		const cubeBoundaries = exposedSectionBoundaries(cube, cubeSection.patches[0])
		expect(cubeBoundaries).toHaveLength(4)
		expect(
			cubeBoundaries.every(({ points }) =>
				points.every((point) => isExteriorSurfacePoint(cube, point)),
			),
		).toBe(true)
		expect(
			cubeBoundaries.find(({ points }) => points.every((point) => point[0] === 0))?.normal,
		).toEqual([-1, 0, 0])

		const solid = {
			voxels: [
				{ x: 0, y: 0, z: 0 },
				{ x: 1, y: 0, z: 0 },
			],
		}
		const section = computeSection(solid, plane)
		const boundaries = section.patches.flatMap((patch) => exposedSectionBoundaries(solid, patch))
		expect(boundaries).toHaveLength(6)
		expect(
			boundaries.some(({ points }) => points.every((point) => Math.abs(point[0] - 1) < 1e-6)),
		).toBe(false)
	})

	it('distinguishes exterior faces from solid interiors and shared faces', () => {
		expect(isExteriorSurfacePoint(solidSingleCube(), [0.5, 0.5, 0])).toBe(true)
		expect(isExteriorSurfacePoint(solidSingleCube(), [0.5, 0.5, 0.5])).toBe(false)
		expect(isExteriorSurfacePoint(solidLTetromino(), [1, 0.5, 0.5])).toBe(false)
		expect(isExteriorSurfacePoint(solidLTetromino(), [0, 0.5, 0.5])).toBe(true)
		expect(isExteriorSurfacePoint(solidLTetromino(), [1, 1, 0.5])).toBe(true)
	})

	it('places labels outside exposed faces and corners', () => {
		const face = cutPointLabelOffset(solidSingleCube(), [0.5, 0.5, 0])
		expect(face[0]).toBeCloseTo(0)
		expect(face[1]).toBeCloseTo(0)
		expect(face[2]).toBeCloseTo(-0.36)
		const corner = cutPointLabelOffset(solidLTetromino(), [0, 0, 0])
		expect(corner.every((value) => value < 0)).toBe(true)
		expect(Math.hypot(...corner)).toBeCloseTo(0.36)
		const top = cutPointLabelOffset(solidLTetromino(), [0, 2, 0])
		expect(top[0]).toBeLessThan(0)
		expect(top[1]).toBeGreaterThan(0)
		expect(top[2]).toBeLessThan(0)
	})

	it('keeps a ray aimed at the interior on the exterior boundary', () => {
		const ray = new THREE.Ray(new THREE.Vector3(0.5, 0.5, -3), new THREE.Vector3(0, 0, 1))
		const target = new THREE.Vector3(0.5, 0.5, 0.5)
		const hit = raycastSolidSurface(solidSingleCube(), ray, target)
		expect(hit).toEqual([0.5, 0.5, 0])
		expect(isExteriorSurfacePoint(solidSingleCube(), hit!)).toBe(true)
	})

	it('can retain a back-face grab without crossing into the solid', () => {
		const ray = new THREE.Ray(new THREE.Vector3(0.5, 0.5, -3), new THREE.Vector3(0, 0, 1))
		const hit = raycastSolidSurface(solidSingleCube(), ray, new THREE.Vector3(0.5, 0.5, 1))
		expect(hit).toEqual([0.5, 0.5, 1])
	})

	it('never returns an internal shared face or a missed ray', () => {
		const insideRay = new THREE.Ray(new THREE.Vector3(1.5, 0.5, 0.5), new THREE.Vector3(-1, 0, 0))
		const hit = raycastSolidSurface(solidLTetromino(), insideRay)
		expect(hit === null || isExteriorSurfacePoint(solidLTetromino(), hit)).toBe(true)
		expect(hit).not.toEqual([1, 0.5, 0.5])
		const missedRay = new THREE.Ray(new THREE.Vector3(8, 8, 8), new THREE.Vector3(1, 0, 0))
		expect(raycastSolidSurface(solidLTetromino(), missedRay)).toBeNull()
	})

	it('projects onto the closest exposed face or edge, never a shared face', () => {
		expect(nearestExteriorPoint(solidSingleCube(), [0.5, 0.5, 0.5])).toEqual([0, 0.5, 0.5])
		expect(nearestExteriorPoint(solidSingleCube(), [3, 0.5, 0.5])).toEqual([1, 0.5, 0.5])
		expect(nearestExteriorPoint(solidSingleCube(), [0.5, 0.5, -3])).toEqual([0.5, 0.5, 0])
		expect(nearestExteriorPoint(solidSingleCube(), [2, 0, 0])).toEqual([1, 0, 0])
		const sharedFace = nearestExteriorPoint(solidLTetromino(), [1, 0.5, 0.5])!
		expect(isExteriorSurfacePoint(solidLTetromino(), sharedFace)).toBe(true)
		expect(sharedFace).not.toEqual([1, 0.5, 0.5])
	})

	it('reattaches points after their voxel is removed or a new voxel covers them', () => {
		const points: CutPoints = [
			[0.5, 0.5, 0.5],
			[0.5, 0.5, 0.5],
			[9, 9, 9],
		]
		const added = addVoxel(solidSingleCube(), [1, 0, 0]).solid
		const attached = snapCutPointsToSolid(added, points)
		for (const point of attached) expect(isExteriorSurfacePoint(added, point)).toBe(true)
		const removed = removeVoxel(solidLTetromino(), [0, 0, 0])
		const afterRemoval = nearestExteriorPoint(removed, [0.5, 0.5, 0.5])!
		expect(isExteriorSurfacePoint(removed, afterRemoval)).toBe(true)
	})

	it('snaps face points to finite exterior edges instead of vertices only', () => {
		expect(nearestExteriorEdgePoint(solidSingleCube(), [0.2, 0.4, 0])).toEqual([0, 0.4, 0])
		expect(nearestExteriorEdgePoint(solidSingleCube(), [2, 0.25, 0])).toEqual([1, 0.25, 0])
		expect(nearestExteriorEdgePoint({ voxels: [] }, [0, 0, 0])).toBeNull()
		const points: CutPoints = [
			[0.2, 0.4, 0],
			[1, 0, 1],
			[0, 1, 0],
		]
		const snapped = snapCutPointsToSolid(solidSingleCube(), points, true)
		expect(snapped[0]).toEqual([0, 0.4, 0])
		for (const point of snapped) {
			expect(isExteriorSurfacePoint(solidSingleCube(), point)).toBe(true)
			expect(point.filter((value) => Number.isInteger(value)).length).toBeGreaterThanOrEqual(2)
		}
	})

	it('excludes internal edges and reattaches after exterior voxels change', () => {
		const solid = {
			voxels: [
				{ x: 0, y: 0, z: 0 },
				{ x: 1, y: 0, z: 0 },
				{ x: 0, y: 1, z: 0 },
				{ x: 1, y: 1, z: 0 },
			],
		}
		const internal = [1, 1, 0.5] as const
		expect(isExteriorSurfacePoint(solid, internal)).toBe(false)
		expect(nearestExteriorEdgePoint(solid, internal)).toEqual([1, 1, 0])
		const removed = removeVoxel(solid, [1, 1, 0])
		expect(nearestExteriorEdgePoint(removed, internal)).toEqual(internal)
		const restored = addVoxel(removed, [1, 1, 0]).solid
		expect(nearestExteriorEdgePoint(restored, internal)).toEqual([1, 1, 0])
	})

	it('preserves attached point state and handles empty models', () => {
		const points: CutPoints = [
			[0, 0, 0],
			[1, 0, 1],
			[0, 1, 0],
		]
		expect(snapCutPointsToSolid(solidSingleCube(), points)).toBe(points)
		expect(snapCutPointsToSolid({ voxels: [] }, points)).toBe(points)
		expect(nearestExteriorPoint({ voxels: [] }, [0, 0, 0])).toBeNull()
	})
})
