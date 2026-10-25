import { describe, expect, it } from 'bun:test'
import * as THREE from 'three'
import { isExteriorSurfacePoint, raycastSolidSurface } from './toolSectionGeometry'
import { solidLTetromino, solidSingleCube } from './toolSectionUtils'

describe('toolSectionGeometry', () => {
	it('distinguishes exterior faces from solid interiors and shared faces', () => {
		expect(isExteriorSurfacePoint(solidSingleCube(), [0.5, 0.5, 0])).toBe(true)
		expect(isExteriorSurfacePoint(solidSingleCube(), [0.5, 0.5, 0.5])).toBe(false)
		expect(isExteriorSurfacePoint(solidLTetromino(), [1, 0.5, 0.5])).toBe(false)
		expect(isExteriorSurfacePoint(solidLTetromino(), [0, 0.5, 0.5])).toBe(true)
		expect(isExteriorSurfacePoint(solidLTetromino(), [1, 1, 0.5])).toBe(true)
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
})
