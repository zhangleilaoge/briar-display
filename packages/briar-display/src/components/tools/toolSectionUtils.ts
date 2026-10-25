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

const CUBE_EDGES: Array<[Vec3, Vec3]> = [
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
	for (const v of solid.voxels) {
		const p = cutVoxel(v, plane)
		if (p) patches.push(p)
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

// ——— 出题 ———

export type QuizKind = 'Q1' | 'Q3' | 'Q4' | 'Q7'

export type QuizOption = {
	id: string
	label: string
	/** 用于渲染的截面或外形描述 */
	section?: Section
	shapeClass?: string
	/** 彩色格点示意（Q3） */
	colorGrid?: Array<{ u: number; v: number; color: VoxelColor }>
	isCorrect: boolean
}

export type QuizQuestion = {
	kind: QuizKind
	prompt: string
	solid: Solid
	/** 题干指定的三点（Q3） */
	points?: [Vec3, Vec3, Vec3]
	/** 作答前锁定旋转 */
	lockOrbitUntilAnswer: boolean
	options: QuizOption[]
	/** 答对后展示的正确截面 */
	correctSection?: Section
	correctPlane?: Plane
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
	const a = [...arr]
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}

const OPTION_IDS = ['A', 'B', 'C', 'D']

/** Q7：单立方经典禁形 —— 正五边形等不可能 */
export function generateQ7(rng: () => number = Math.random): QuizQuestion {
	const solid = solidSingleCube()
	const legal = legalShapeClasses(solid, 200)
	const planes = enumeratePlanes(solid, 200)
	const legalSecs = planes.map((p) => computeSection(solid, p))
	// 合法选项：三角形 / 四边形 / 五边形（立方体截面最多六边形，五边形合法）/ 六边形
	const byEdges = new Map<number, Section>()
	for (const s of legalSecs) {
		const e = s.patches[0]?.points.length ?? 0
		if (e >= 3 && e <= 6 && !byEdges.has(e)) byEdges.set(e, s)
	}
	const correctEdges = 7 // 七边形不可能
	const distractors = [3, 4, 5, 6].filter((e) => byEdges.has(e))
	const pick = shuffle(distractors, rng).slice(0, 3)
	while (pick.length < 3) {
		const fallback = [3, 4, 5, 6].find((e) => !pick.includes(e) && byEdges.has(e))
		if (fallback == null) break
		pick.push(fallback)
	}
	const labels: Record<number, string> = {
		3: '三角形',
		4: '平行四边形 / 矩形',
		5: '五边形',
		6: '六边形',
	}
	const optionsRaw: QuizOption[] = [
		...pick.map((e) => ({
			id: '',
			label: labels[e] ?? `${e} 边形`,
			section: byEdges.get(e),
			shapeClass: byEdges.has(e)
				? shapeClassSignature(byEdges.get(e)!)
				: `parts=1|edges=${e}|conv=C`,
			isCorrect: false,
		})),
		{
			id: '',
			label: '正七边形',
			shapeClass: 'parts=1|edges=7|conv=C',
			isCorrect: true,
		},
	]
	// 不足 4 个时用文字干扰项补齐
	const padLabels = ['圆形', '八边形', '五角星']
	let pi = 0
	while (optionsRaw.length < 4 && pi < padLabels.length) {
		optionsRaw.push({
			id: '',
			label: padLabels[pi++],
			shapeClass: `parts=1|edges=pad${pi}|conv=C`,
			isCorrect: false,
		})
	}
	const options = shuffle(optionsRaw, rng).map((o, i) => ({ ...o, id: OPTION_IDS[i] }))
	void legal
	void correctEdges
	return {
		kind: 'Q7',
		prompt: '将一个正方体用平面任意剖开，下面哪一种不可能是它的截面？',
		solid,
		lockOrbitUntilAnswer: true,
		options,
	}
}

/** Q1：任意剖开 · 不可能截面（复合体） */
export function generateQ1(rng: () => number = Math.random): QuizQuestion {
	const solid = rng() < 0.5 ? solidLTetromino() : solidStair3()
	const planes = enumeratePlanes(solid, 500)
	const legalClasses = new Set<string>()
	const examples = new Map<string, Section>()
	for (const plane of planes) {
		const sec = computeSection(solid, plane)
		const cls = shapeClassSignature(sec)
		legalClasses.add(cls)
		if (!examples.has(cls)) examples.set(cls, sec)
	}
	const legalList = [...examples.entries()]
	const pickLegal = shuffle(legalList, rng).slice(0, 3)
	// 干扰：经典「房子」五边形（凸五边且边长比接近屋顶）——若碰巧合法则换边数更大的不可能
	let impossibleLabel = '凸五边形（屋顶形）'
	let impossibleClass = 'parts=1|edges=5|conv=C|roof'
	const hasConvexPent =
		[...legalClasses].some((c) => c.includes('edges=5') && c.includes('conv=C')) &&
		[...examples.values()].some((s) => s.patches.length === 1 && s.patches[0].points.length === 5)
	// 对 L 四连体，单一凸五边形常常不可能；用「两个分离三角形」等更稳的不可能
	if (hasConvexPent || pickLegal.length < 3) {
		impossibleLabel = '两个分离的三角形'
		impossibleClass = 'parts=2|edges=3,3|conv=CC|sep'
		// 若该 solid 真能切出两个分离三角，再换成九边形
		if (legalClasses.has('parts=2|edges=3,3|conv=CC')) {
			impossibleLabel = '九边形'
			impossibleClass = 'parts=1|edges=9|conv=C'
		}
	}
	const optionsRaw: QuizOption[] = [
		...pickLegal.map(([cls, sec]) => ({
			id: '',
			label: describeShape(sec),
			section: sec,
			shapeClass: cls,
			isCorrect: false,
		})),
		{
			id: '',
			label: impossibleLabel,
			shapeClass: impossibleClass,
			isCorrect: true,
		},
	]
	const options = shuffle(optionsRaw, rng).map((o, i) => ({ ...o, id: OPTION_IDS[i] }))
	return {
		kind: 'Q1',
		prompt: `左图由 ${solid.voxels.length} 个相同正方体组成。将其从任一平面剖开，下面哪一项不可能是该立体的截面？`,
		solid,
		lockOrbitUntilAnswer: true,
		options,
	}
}

function describeShape(sec: Section): string {
	if (sec.patches.length === 0) return '空'
	if (sec.patches.length === 1) {
		const n = sec.patches[0].points.length
		const poly = projectTo2D(sec.patches[0].points, estimateNormal(sec.patches[0].points))
		return `${isConvex2D(poly) ? '凸' : '凹'}${n}边形`
	}
	const parts = sec.patches.map((p) => `${p.points.length}边`).join('+')
	return `${sec.patches.length} 块（${parts}）`
}

/** Q4：可见切面选轮廓 */
export function generateQ4(rng: () => number = Math.random): QuizQuestion {
	const solid = solidLTetromino()
	const planes = enumeratePlanes(solid, 400)
	const withSec = planes
		.map((plane) => ({ plane, section: computeSection(solid, plane) }))
		.filter((x) => x.section.patches.length >= 1)
	const chosen = withSec[Math.floor(rng() * withSec.length)]
	const correctCls = shapeClassSignature(chosen.section)
	const others = shuffle(
		withSec.filter((x) => shapeClassSignature(x.section) !== correctCls),
		rng,
	).slice(0, 3)
	const optionsRaw: QuizOption[] = [
		{
			id: '',
			label: describeShape(chosen.section),
			section: chosen.section,
			shapeClass: correctCls,
			isCorrect: true,
		},
		...others.map((o) => ({
			id: '',
			label: describeShape(o.section),
			section: o.section,
			shapeClass: shapeClassSignature(o.section),
			isCorrect: false,
		})),
	]
	const options = shuffle(optionsRaw, rng).map((o, i) => ({ ...o, id: OPTION_IDS[i] }))
	return {
		kind: 'Q4',
		prompt: '观察左图立体，若沿图示方向剖开，正确的截面轮廓是？',
		solid,
		lockOrbitUntilAnswer: true,
		options,
		correctSection: chosen.section,
		correctPlane: chosen.plane,
	}
}

/** Q3：过 ABC 三点 + 黑白着色四选一 */
export function generateQ3(rng: () => number = Math.random): QuizQuestion {
	// 构造带黑色的小立体
	let solid = solidWithColors(solidLTetromino(), ['0,0,0', '1,0,0'])
	if (rng() < 0.4) {
		solid = randomSolid(rng, 8)
		// 随机涂黑
		solid = {
			voxels: solid.voxels.map((v) => ({
				...v,
				color: rng() < 0.3 ? 'gray' : 'white',
			})),
		}
	}
	const verts = solidVertices(solid)
	const planes = enumeratePlanes(solid, 300)
	const candidates = planes
		.map((plane) => ({ plane, section: computeSection(solid, plane) }))
		.filter((x) => x.section.patches.some((p) => p.color === 'gray'))
	const pool =
		candidates.length > 0
			? candidates
			: planes.map((plane) => ({ plane, section: computeSection(solid, plane) }))
	const chosen = pool[Math.floor(rng() * pool.length)]
	// 找近似落在平面上的三个格点作为 ABC
	const onPlane = verts
		.map((p) => ({ p, d: Math.abs(planeSide(chosen.plane, p)) }))
		.filter((x) => x.d < 1e-6)
		.map((x) => x.p)
	let points: [Vec3, Vec3, Vec3]
	if (onPlane.length >= 3) {
		points = [onPlane[0], onPlane[1], onPlane[2]]
	} else {
		points = [verts[0], verts[1], verts[2]]
	}
	const correctGrid = sectionToColorGrid(chosen.section, chosen.plane)
	const wrongGrids: QuizOption[] = []
	for (const other of shuffle(pool, rng)) {
		if (other.section.signature === chosen.section.signature) continue
		const g = sectionToColorGrid(other.section, other.plane)
		if (JSON.stringify(g) === JSON.stringify(correctGrid)) continue
		wrongGrids.push({
			id: '',
			label: '着色截面',
			section: other.section,
			colorGrid: g,
			isCorrect: false,
		})
		if (wrongGrids.length >= 3) break
	}
	while (wrongGrids.length < 3) {
		// 扰动：交换颜色
		const perturbed = correctGrid.map((c, i) =>
			i === wrongGrids.length
				? { ...c, color: c.color === 'gray' ? 'white' : ('gray' as VoxelColor) }
				: c,
		)
		wrongGrids.push({
			id: '',
			label: '着色截面',
			colorGrid: perturbed,
			isCorrect: false,
		})
	}
	const optionsRaw: QuizOption[] = [
		{
			id: '',
			label: '着色截面',
			section: chosen.section,
			colorGrid: correctGrid,
			isCorrect: true,
		},
		...wrongGrids,
	]
	const options = shuffle(optionsRaw, rng).map((o, i) => ({ ...o, id: OPTION_IDS[i] }))
	return {
		kind: 'Q3',
		prompt: '左图立体由白色与黑色小正方体组成。过顶点 A、B、C 的平面剖开后，正确的截面是？',
		solid,
		points,
		lockOrbitUntilAnswer: true,
		options,
		correctSection: chosen.section,
		correctPlane: chosen.plane,
	}
}

function sectionToColorGrid(
	section: Section,
	plane: Plane,
): Array<{ u: number; v: number; color: VoxelColor }> {
	const cells: Array<{ u: number; v: number; color: VoxelColor }> = []
	for (const patch of section.patches) {
		const c = patch.points.reduce(
			(acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]] as Vec3,
			[0, 0, 0] as Vec3,
		)
		const centroid: Vec3 = [
			c[0] / patch.points.length,
			c[1] / patch.points.length,
			c[2] / patch.points.length,
		]
		const [u, v] = projectTo2D([centroid], plane.normal)[0]
		cells.push({ u: round2(u), v: round2(v), color: patch.color })
	}
	return cells.sort((a, b) => a.v - b.v || a.u - b.u)
}

export function generateQuiz(kind: QuizKind, rng: () => number = Math.random): QuizQuestion {
	switch (kind) {
		case 'Q1':
			return generateQ1(rng)
		case 'Q3':
			return generateQ3(rng)
		case 'Q4':
			return generateQ4(rng)
		case 'Q7':
			return generateQ7(rng)
	}
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
