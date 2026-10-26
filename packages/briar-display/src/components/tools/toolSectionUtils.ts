/**
 * 切面模拟器：整数格点单位正方体的截面计算与出题
 * 坐标均为整数；自建数量不限，随机图在 3×3×3 内按面相邻生成
 */

export type VoxelColor = 'white' | 'gray'
export type Voxel = { x: number; y: number; z: number; color?: VoxelColor }
export type Solid = { voxels: Voxel[] }
export type Vec3 = readonly [number, number, number]

export type Plane = {
	/** 平面上一点 */
	point: Vec3
	/** 法向量（不必单位化） */
	normal: Vec3
}

export type SectionPatch = {
	/** 平面上的多边形顶点（3D，有序） */
	points: Vec3[]
	color: VoxelColor
	voxel: Voxel
}

export type SectionLoop = {
	points: Vec3[]
}

export type Section = {
	loops: SectionLoop[]
	patches: SectionPatch[]
	edgeCount: number
	/** 规范化签名：用于合法/干扰比对 */
	signature: string
}

const EPS = 1e-9

export function vecAdd(a: Vec3, b: Vec3): Vec3 {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
export function vecSub(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
export function vecScale(a: Vec3, s: number): Vec3 {
	return [a[0] * s, a[1] * s, a[2] * s]
}
export function vecDot(a: Vec3, b: Vec3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
export function vecCross(a: Vec3, b: Vec3): Vec3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
export function vecLen(a: Vec3): number {
	return Math.hypot(a[0], a[1], a[2])
}
export function vecNorm(a: Vec3): Vec3 {
	const L = vecLen(a)
	if (L < EPS) return [0, 0, 0]
	return [a[0] / L, a[1] / L, a[2] / L]
}
export function vecEq(a: Vec3, b: Vec3, eps = 1e-6): boolean {
	return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps
}
export function voxelKey(v: Pick<Voxel, 'x' | 'y' | 'z'>): string {
	return `${v.x},${v.y},${v.z}`
}

export function assertIntegerSolid(solid: Solid): void {
	for (const v of solid.voxels) {
		if (![v.x, v.y, v.z].every((n) => Number.isInteger(n))) {
			throw new Error('坐标必须为整数')
		}
	}
}

/** 体素占用的全部格点顶点 */
export function solidVertices(solid: Solid): Vec3[] {
	const set = new Set<string>()
	const out: Vec3[] = []
	for (const v of solid.voxels) {
		for (let dx = 0; dx <= 1; dx++) {
			for (let dy = 0; dy <= 1; dy++) {
				for (let dz = 0; dz <= 1; dz++) {
					const p: Vec3 = [v.x + dx, v.y + dy, v.z + dz]
					const k = `${p[0]},${p[1]},${p[2]}`
					if (!set.has(k)) {
						set.add(k)
						out.push(p)
					}
				}
			}
		}
	}
	return out
}

export function planeFromPoints(a: Vec3, b: Vec3, c: Vec3): Plane | null {
	const n = vecCross(vecSub(b, a), vecSub(c, a))
	if (vecLen(n) < EPS) return null
	return { point: a, normal: n }
}

/** 规范化平面键：用于去重（忽略缩放与符号） */
export function planeKey(plane: Plane): string {
	const n = vecNorm(plane.normal)
	const sign =
		n[0] < -EPS ||
		(Math.abs(n[0]) < EPS && n[1] < -EPS) ||
		(Math.abs(n[0]) < EPS && Math.abs(n[1]) < EPS && n[2] < 0)
			? -1
			: 1
	const nn: Vec3 = [n[0] * sign, n[1] * sign, n[2] * sign]
	const nd = -vecDot(nn, plane.point)
	const r = (x: number) => Math.round(x * 1e6) / 1e6
	return `${r(nn[0])},${r(nn[1])},${r(nn[2])},${r(nd)}`
}

export const CUBE_EDGES: Array<[Vec3, Vec3]> = [
	[
		[0, 0, 0],
		[1, 0, 0],
	],
	[
		[0, 0, 0],
		[0, 1, 0],
	],
	[
		[0, 0, 0],
		[0, 0, 1],
	],
	[
		[1, 0, 0],
		[1, 1, 0],
	],
	[
		[1, 0, 0],
		[1, 0, 1],
	],
	[
		[0, 1, 0],
		[1, 1, 0],
	],
	[
		[0, 1, 0],
		[0, 1, 1],
	],
	[
		[0, 0, 1],
		[1, 0, 1],
	],
	[
		[0, 0, 1],
		[0, 1, 1],
	],
	[
		[1, 1, 0],
		[1, 1, 1],
	],
	[
		[1, 0, 1],
		[1, 1, 1],
	],
	[
		[0, 1, 1],
		[1, 1, 1],
	],
]

function planeSide(plane: Plane, p: Vec3): number {
	return vecDot(plane.normal, vecSub(p, plane.point))
}

function intersectEdge(plane: Plane, a: Vec3, b: Vec3): Vec3 | null {
	const da = planeSide(plane, a)
	const db = planeSide(plane, b)
	if (Math.abs(da) < EPS && Math.abs(db) < EPS) return null // 边在平面上，交点由端点单独处理
	if (Math.abs(da) < EPS) return a
	if (Math.abs(db) < EPS) return b
	if (da * db > 0) return null
	const t = da / (da - db)
	return vecAdd(a, vecScale(vecSub(b, a), t))
}

/** 把平面上的点排成凸多边形（按绕法向角度） */
function orderPolygon(points: Vec3[], normal: Vec3): Vec3[] {
	if (points.length < 3) return points
	const uniq: Vec3[] = []
	for (const p of points) {
		if (!uniq.some((q) => vecEq(p, q))) uniq.push(p)
	}
	if (uniq.length < 3) return uniq
	const c: Vec3 = [
		uniq.reduce((s, p) => s + p[0], 0) / uniq.length,
		uniq.reduce((s, p) => s + p[1], 0) / uniq.length,
		uniq.reduce((s, p) => s + p[2], 0) / uniq.length,
	]
	const n = vecNorm(normal)
	let u = vecNorm(vecCross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
	const v = vecNorm(vecCross(n, u))
	u = vecNorm(vecCross(v, n))
	return uniq
		.map((p) => {
			const d = vecSub(p, c)
			return { p, ang: Math.atan2(vecDot(d, v), vecDot(d, u)) }
		})
		.sort((a, b) => a.ang - b.ang)
		.map((x) => x.p)
}

function cutVoxel(voxel: Voxel, plane: Plane): SectionPatch | null {
	const origin: Vec3 = [voxel.x, voxel.y, voxel.z]
	const hits: Vec3[] = []
	for (const [ea, eb] of CUBE_EDGES) {
		const a = vecAdd(origin, ea)
		const b = vecAdd(origin, eb)
		const hit = intersectEdge(plane, a, b)
		if (hit) hits.push(hit)
	}
	const ordered = orderPolygon(hits, plane.normal)
	if (ordered.length < 3) return null
	return {
		points: ordered,
		color: voxel.color ?? 'white',
		voxel,
	}
}

function projectTo2D(points: Vec3[], normal: Vec3): Array<[number, number]> {
	const n = vecNorm(normal)
	let u = vecNorm(vecCross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
	const v = vecNorm(vecCross(n, u))
	u = vecNorm(vecCross(v, n))
	return points.map((p) => [vecDot(p, u), vecDot(p, v)] as [number, number])
}

/** 2D 多边形是否凸 */
function isConvex2D(poly: Array<[number, number]>): boolean {
	if (poly.length < 3) return false
	let sign = 0
	const n = poly.length
	for (let i = 0; i < n; i++) {
		const [x1, y1] = poly[i]
		const [x2, y2] = poly[(i + 1) % n]
		const [x3, y3] = poly[(i + 2) % n]
		const z = (x2 - x1) * (y3 - y2) - (y2 - y1) * (x3 - x2)
		if (Math.abs(z) < 1e-8) continue
		const s = z > 0 ? 1 : -1
		if (sign === 0) sign = s
		else if (s !== sign) return false
	}
	return true
}

function round2(n: number): number {
	return Math.round(n * 100) / 100
}

/**
 * 单个 patch 的形状指纹：边数 + 凸/凹 + 边长序列（相对）
 */
function patchFingerprint(points: Vec3[], normal: Vec3): string {
	const poly = projectTo2D(points, normal)
	const m = poly.length
	const lens: number[] = []
	for (let i = 0; i < m; i++) {
		const [x1, y1] = poly[i]
		const [x2, y2] = poly[(i + 1) % m]
		lens.push(Math.hypot(x2 - x1, y2 - y1))
	}
	const maxL = Math.max(...lens, EPS)
	const rel = lens.map((l) => round2(l / maxL))
	// 旋转归一：字典序最小的循环
	let best = rel.join(',')
	for (let s = 1; s < m; s++) {
		const rot = rel.slice(s).concat(rel.slice(0, s)).join(',')
		if (rot < best) best = rot
	}
	const rev = [...rel].reverse()
	let bestRev = rev.join(',')
	for (let s = 1; s < m; s++) {
		const rot = rev.slice(s).concat(rev.slice(0, s)).join(',')
		if (rot < bestRev) bestRev = rot
	}
	if (bestRev < best) best = bestRev
	return `${m}:${isConvex2D(poly) ? 'C' : 'N'}:${best}`
}

export function computeSection(solid: Solid, plane: Plane): Section {
	assertIntegerSolid(solid)
	const patches: SectionPatch[] = []
	const seen = new Set<string>()
	for (const v of solid.voxels) {
		const p = cutVoxel(v, plane)
		if (!p) continue
		const key = p.points
			.map((point) => point.map((value) => value.toFixed(6)).join(','))
			.sort()
			.join('|')
		if (seen.has(key)) continue
		seen.add(key)
		patches.push(p)
	}
	const loops: SectionLoop[] = patches.map((p) => ({ points: p.points }))
	const edgeCount = patches.length === 0 ? 0 : Math.max(...patches.map((p) => p.points.length))
	const fps = patches.map((p) => `${p.color}:${patchFingerprint(p.points, plane.normal)}`).sort()
	const signature =
		patches.length === 0 ? 'empty' : `n=${patches.length}|e=${edgeCount}|${fps.join(';')}`
	return { loops, patches, edgeCount, signature }
}

/** 枚举过格点的切割平面（去重） */
export function enumeratePlanes(solid: Solid, limit = 400): Plane[] {
	const verts = solidVertices(solid)
	const seen = new Set<string>()
	const planes: Plane[] = []
	const n = verts.length
	for (let i = 0; i < n && planes.length < limit; i++) {
		for (let j = i + 1; j < n && planes.length < limit; j++) {
			for (let k = j + 1; k < n && planes.length < limit; k++) {
				const plane = planeFromPoints(verts[i], verts[j], verts[k])
				if (!plane) continue
				const key = planeKey(plane)
				if (seen.has(key)) continue
				seen.add(key)
				const sec = computeSection(solid, plane)
				if (sec.patches.length === 0) continue
				planes.push(plane)
			}
		}
	}
	return planes
}

export function legalSignatures(solid: Solid, limit = 400): Set<string> {
	const set = new Set<string>()
	for (const plane of enumeratePlanes(solid, limit)) {
		set.add(computeSection(solid, plane).signature)
	}
	return set
}

/** 仅边数维度的「外形类」签名，用于不可能截面题 */
export function shapeClassSignature(section: Section): string {
	if (section.patches.length === 0) return 'empty'
	const counts = section.patches.map((p) => p.points.length).sort((a, b) => a - b)
	const convexFlags = section.patches.map((p) => {
		const poly = projectTo2D(p.points, estimateNormal(p.points))
		return isConvex2D(poly) ? 'C' : 'N'
	})
	return `parts=${counts.length}|edges=${counts.join(',')}|conv=${convexFlags.join('')}`
}

function estimateNormal(points: Vec3[]): Vec3 {
	if (points.length < 3) return [0, 0, 1]
	return vecCross(vecSub(points[1], points[0]), vecSub(points[2], points[0]))
}

export function legalShapeClasses(solid: Solid, limit = 400): Set<string> {
	const set = new Set<string>()
	for (const plane of enumeratePlanes(solid, limit)) {
		set.add(shapeClassSignature(computeSection(solid, plane)))
	}
	return set
}

// ——— 预设体 ———

export function solidSingleCube(color: VoxelColor = 'white'): Solid {
	return { voxels: [{ x: 0, y: 0, z: 0, color }] }
}

/** 例题类似：L 形三连 + 上层一颗 */
export function solidLTetromino(): Solid {
	return {
		voxels: [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 },
			{ x: 0, y: 1, z: 0 },
			{ x: 0, y: 0, z: 1 },
		],
	}
}

export function solidStair3(): Solid {
	return {
		voxels: [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 0 },
			{ x: 1, y: 0, z: 1 },
			{ x: 2, y: 0, z: 1 },
			{ x: 2, y: 0, z: 2 },
		],
	}
}

export function randomSolid(rng: () => number = Math.random, count = 6): Solid {
	const gridSize = 3
	const n = Math.max(1, Math.min(gridSize ** 3, Math.floor(count)))
	const cells = new Map<string, Voxel>()
	cells.set('0,0,0', { x: 0, y: 0, z: 0, color: 'white' })
	const dirs: Vec3[] = [
		[1, 0, 0],
		[-1, 0, 0],
		[0, 1, 0],
		[0, -1, 0],
		[0, 0, 1],
		[0, 0, -1],
	]
	while (cells.size < n) {
		const candidates: Vec3[] = []
		const candidateKeys = new Set<string>()
		for (const base of cells.values()) {
			for (const direction of dirs) {
				const cell: Vec3 = [base.x + direction[0], base.y + direction[1], base.z + direction[2]]
				const key = voxelKey({ x: cell[0], y: cell[1], z: cell[2] })
				if (
					cell.every((value) => value >= 0 && value < gridSize) &&
					!cells.has(key) &&
					!candidateKeys.has(key)
				) {
					candidateKeys.add(key)
					candidates.push(cell)
				}
			}
		}
		if (candidates.length === 0) break
		const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))
		const next = candidates[index]
		cells.set(voxelKey({ x: next[0], y: next[1], z: next[2] }), {
			x: next[0],
			y: next[1],
			z: next[2],
			color: rng() < 0.25 ? 'gray' : 'white',
		})
	}
	return { voxels: [...cells.values()] }
}

export function solidWithColors(base: Solid, grayKeys: string[]): Solid {
	const set = new Set(grayKeys)
	return {
		voxels: base.voxels.map((v) => ({
			...v,
			color: set.has(voxelKey(v)) ? 'gray' : 'white',
		})),
	}
}

/** 优先使用立体顶点；平面不经过三个顶点时改用截交点。 */
export function cutPointsForPlane(solid: Solid, plane: Plane): [Vec3, Vec3, Vec3] | null {
	const vertices = solidVertices(solid).filter((point) => Math.abs(planeSide(plane, point)) < 1e-6)
	const sectionPoints = computeSection(solid, plane).patches.flatMap((patch) => patch.points)
	const candidates = vertices.length >= 3 ? vertices : sectionPoints
	let best: [Vec3, Vec3, Vec3] | null = null
	let bestArea = 1e-9
	for (let i = 0; i < candidates.length; i++) {
		for (let j = i + 1; j < candidates.length; j++) {
			for (let k = j + 1; k < candidates.length; k++) {
				const a = candidates[i]
				const b = candidates[j]
				const c = candidates[k]
				const area = vecLen(vecCross(vecSub(b, a), vecSub(c, a)))
				if (area > bestArea) {
					bestArea = area
					best = [a, b, c]
				}
			}
		}
	}
	return best
}

export function toggleVoxel(solid: Solid, x: number, y: number, z: number): Solid {
	assertIntegerSolid(solid)
	const k = `${x},${y},${z}`
	const exists = solid.voxels.find((v) => voxelKey(v) === k)
	if (exists) {
		const next = { voxels: solid.voxels.filter((v) => voxelKey(v) !== k) }
		if (next.voxels.length === 0) return solid
		return next
	}
	return { voxels: [...solid.voxels, { x, y, z, color: 'white' }] }
}

export function setVoxelColor(
	solid: Solid,
	x: number,
	y: number,
	z: number,
	color: VoxelColor,
): Solid {
	return {
		voxels: solid.voxels.map((v) => (v.x === x && v.y === y && v.z === z ? { ...v, color } : v)),
	}
}
