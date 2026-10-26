import { describe, expect, it } from 'bun:test'
import { solidPreviewFaces } from './toolSectionSolidPreview'
import { cuboid } from './toolSectionSolids'
import { type Vec3, solidSingleCube } from './toolSectionUtils'

const normalKey = (normal: Vec3) => normal.join(',')

describe('toolSectionSolidPreview', () => {
	it('uses the supplied view direction instead of a fixed isometric angle', () => {
		const solid = solidSingleCube()
		const front = solidPreviewFaces(solid, [5, 4, 5])
		const back = solidPreviewFaces(solid, [-5, 4, -5])
		expect(front.map((face) => normalKey(face.normal)).sort()).toEqual(['0,0,1', '0,1,0', '1,0,0'])
		expect(back.map((face) => normalKey(face.normal)).sort()).toEqual(['-1,0,0', '0,0,-1', '0,1,0'])
		expect(front.map((face) => face.points)).not.toEqual(back.map((face) => face.points))
	})

	it('shows only the top face when viewed directly from above', () => {
		const faces = solidPreviewFaces(solidSingleCube(), [0, 1, 0])
		expect(faces).toHaveLength(1)
		expect(faces[0].normal).toEqual([0, 1, 0])
		expect(faces[0].points).toHaveLength(4)
	})

	it('removes internal faces and back faces', () => {
		expect(solidPreviewFaces(cuboid(2, 2, 2), [1, 1, 1])).toHaveLength(12)
		expect(solidPreviewFaces(cuboid(2, 2, 2), [-1, -1, -1])).toHaveLength(12)
	})

	it('keeps the default x axis to the right and z axis to the left', () => {
		const faces = solidPreviewFaces(solidSingleCube())
		const top = faces.find((face) => face.normal[1] === 1)!
		expect(top.points[3][0]).toBeGreaterThan(top.points[0][0])
		expect(top.points[0][0]).toBeGreaterThan(top.points[1][0])
	})
})
