import { describe, expect, it } from 'bun:test'
import { sectionToSvgPaths } from './toolSectionSvg'
import { computeSection, planeFromPoints, solidSingleCube } from './toolSectionUtils'

const plane = planeFromPoints([0, 0, 0], [1, 0, 0], [0, 1, 0])!
const points: Array<readonly [number, number, number]> = [
	[0, 0, 0],
	[2, 0, 0],
	[0, 1, 0],
]

describe('toolSectionSvg', () => {
	it('starts sandbox rotation counterclockwise and rotates the markers with the shape', () => {
		const section = computeSection(solidSingleCube(), plane)
		const svg = sectionToSvgPaths(section, plane, 240, points, 1)
		const expected = [
			[28.8, 211.2],
			[211.2, 211.2],
			[28.8, 120],
		]
		svg.markers.forEach((marker, index) => {
			expect(marker.x).toBeCloseTo(expected[index][0])
			expect(marker.y).toBeCloseTo(expected[index][1])
		})
		expect(sectionToSvgPaths(section, plane, 240, points, 0)).toEqual(
			sectionToSvgPaths(section, plane, 240, points, 4),
		)
		expect(sectionToSvgPaths(section, plane, 240, points, 2)).toEqual(
			sectionToSvgPaths(section, plane, 240, points, 1 + 1),
		)
		expect(sectionToSvgPaths(section, plane, 240, points, 0)).toEqual(
			sectionToSvgPaths(section, plane, 240, points, 1 - 1),
		)
	})

	it('draws only the exterior outline of a connected L-shaped section', () => {
		const section = computeSection(
			{
				voxels: [
					{ x: 0, y: 0, z: 0, color: 'gray' },
					{ x: 1, y: 0, z: 0 },
					{ x: 0, y: 1, z: 0 },
				],
			},
			plane,
		)
		const svg = sectionToSvgPaths(section, plane, 240)
		expect(svg.paths).toHaveLength(3)
		expect(svg.outlines).toHaveLength(1)
		expect(svg.outlines[0].match(/[ML]/g)).toHaveLength(8)
		const coordinates = svg.outlines[0].match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
		expect(coordinates.length).toBe(16)
		expect(coordinates.every((value) => value >= 0 && value <= 240)).toBe(true)
		expect(svg.paths.find((path) => path.voxel.x === 0)?.color).toBe('gray')
		expect(sectionToSvgPaths(section, plane, 240, undefined, 1).outlines).toHaveLength(1)
	})

	it('keeps separate outlines for disconnected parts', () => {
		const section = computeSection(
			{
				voxels: [
					{ x: 0, y: 0, z: 0 },
					{ x: 2, y: 0, z: 0 },
				],
			},
			plane,
		)
		const svg = sectionToSvgPaths(section, plane, 240)
		expect(svg.paths).toHaveLength(2)
		expect(svg.outlines).toHaveLength(2)
		expect(svg.outlines.every((path) => path.match(/[ML]/g)?.length === 4)).toBe(true)
	})

	it('returns an empty projection without inventing bounds', () => {
		const svg = sectionToSvgPaths(computeSection({ voxels: [] }, plane), plane)
		expect(svg).toEqual({ paths: [], outlines: [], markers: [], width: 120, height: 120 })
	})
})
