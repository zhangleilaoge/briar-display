import {
	type Plane,
	type Section,
	type Vec3,
	type Voxel,
	type VoxelColor,
	vecCross,
	vecDot,
	vecNorm,
} from './toolSectionUtils'

type Point2 = [number, number]

type OutlineEdge = {
	id: number
	owners: number[]
	points: [Point2, Point2]
}

export type SectionSvgProjection = {
	paths: Array<{ d: string; color: VoxelColor; voxel: Voxel }>
	outlines: string[]
	markers: Array<{ id: string; x: number; y: number }>
	width: number
	height: number
}

const pointKey = ([x, y]: Point2) => `${x.toFixed(6)},${y.toFixed(6)}`

function projectTo2D(point: Vec3, normal: Vec3): Point2 {
	const n = vecNorm(normal)
	let u = vecNorm(vecCross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
	const v = vecNorm(vecCross(n, u))
	u = vecNorm(vecCross(v, n))
	return [vecDot(point, u), vecDot(point, v)]
}

function rotate([u, v]: Point2, quarterTurns: number): Point2 {
	switch (((quarterTurns % 4) + 4) % 4) {
		case 1:
			return [-v, u]
		case 2:
			return [-u, -v]
		case 3:
			return [v, -u]
		default:
			return [u, v]
	}
}

function transformPoint(
	point: Point2,
	quarterTurns: number,
	reflection: { x?: boolean; y?: boolean },
): Point2 {
	const [u, v] = rotate(point, quarterTurns)
	return [reflection.y ? -u : u, reflection.x ? -v : v]
}

function sectionOutlines(
	polys: Array<{ points: Point2[]; keys: string[] }>,
	toPath: (points: Point2[]) => string,
) {
	const parents = polys.map((_, index) => index)
	const find = (index: number): number => {
		if (parents[index] !== index) parents[index] = find(parents[index])
		return parents[index]
	}
	const edgeMap = new Map<string, OutlineEdge>()
	const positions = new Map<string, Point2>()
	polys.forEach((poly, owner) => {
		poly.points.forEach((point, index) => {
			const next = (index + 1) % poly.points.length
			const a = poly.keys[index]
			const b = poly.keys[next]
			positions.set(a, point)
			positions.set(b, poly.points[next])
			const key = [a, b].sort().join('|')
			const edge = edgeMap.get(key)
			if (edge) {
				edge.owners.push(owner)
				const root = find(owner)
				const other = find(edge.owners[0])
				if (root !== other) parents[root] = other
				return
			}
			edgeMap.set(key, {
				id: edgeMap.size,
				owners: [owner],
				points: [point, poly.points[next]],
			})
		})
	})

	const groups = new Map<number, Map<string, Array<{ edgeId: number; destination: string }>>>()
	for (const edge of edgeMap.values()) {
		if (edge.owners.length >= 2) continue
		const [a, b] = edge.points.map(pointKey)
		const root = find(edge.owners[0])
		const adjacency = groups.get(root) ?? new Map()
		groups.set(root, adjacency)
		const from = adjacency.get(a) ?? []
		const to = adjacency.get(b) ?? []
		from.push({ edgeId: edge.id, destination: b })
		to.push({ edgeId: edge.id, destination: a })
		adjacency.set(a, from)
		adjacency.set(b, to)
	}

	const visited = new Set<number>()
	const outlines: string[] = []
	for (const adjacency of groups.values()) {
		for (const [start, firstEdges] of adjacency) {
			for (const first of firstEdges) {
				if (visited.has(first.edgeId)) continue
				let current = start
				const loop: Point2[] = []
				while (current !== start || loop.length === 0) {
					const edge = adjacency.get(current)?.find((candidate) => !visited.has(candidate.edgeId))
					if (!edge) break
					const point = positions.get(current)
					if (!point) break
					loop.push(point)
					visited.add(edge.edgeId)
					current = edge.destination
				}
				if (loop.length >= 3 && current === start) outlines.push(toPath(loop))
			}
		}
	}
	return outlines
}

/** 截面多边形与切点共用等比二维投影，依次应用旋转和轴对称。 */
export function sectionToSvgPaths(
	section: Section,
	plane: Plane,
	size = 120,
	points?: Vec3[],
	quarterTurns = 0,
	reflection: { x?: boolean; y?: boolean } = {},
): SectionSvgProjection {
	if (section.patches.length === 0 && !points?.length) {
		return { paths: [], outlines: [], markers: [], width: size, height: size }
	}
	const all2: Point2[] = []
	const polys = section.patches.map((patch) => {
		const projected = patch.points.map((point) =>
			transformPoint(projectTo2D(point, plane.normal), quarterTurns, reflection),
		)
		all2.push(...projected)
		return { points: projected, color: patch.color, voxel: patch.voxel }
	})
	const projectedMarkers = (points ?? []).map((point, index) => {
		const projected = transformPoint(projectTo2D(point, plane.normal), quarterTurns, reflection)
		all2.push(projected)
		return { id: 'ABC'[index], point: projected }
	})
	const xs = all2.map((point) => point[0])
	const ys = all2.map((point) => point[1])
	const minX = Math.min(...xs)
	const maxX = Math.max(...xs)
	const minY = Math.min(...ys)
	const maxY = Math.max(...ys)
	const span = Math.max(maxX - minX, maxY - minY, 1e-9)
	const pad = size * 0.12
	const scale = (size - pad * 2) / span
	const to = ([u, v]: Point2): Point2 => [
		pad + (u - minX) * scale,
		size - (pad + (v - minY) * scale),
	]
	const toPath = (mapped: Point2[]) =>
		`${mapped
			.map(
				(point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`,
			)
			.join(' ')} Z`
	const paths = polys.map(({ points, color, voxel }) => ({
		d: toPath(points.map(to)),
		color,
		voxel,
	}))
	const outlines = sectionOutlines(
		polys.map(({ points }) => {
			const mapped = points.map(to)
			return { points: mapped, keys: mapped.map(pointKey) }
		}),
		toPath,
	)
	const markers = projectedMarkers.map(({ id, point }) => {
		const [x, y] = to(point)
		return { id, x, y }
	})
	return { paths, outlines, markers, width: size, height: size }
}
