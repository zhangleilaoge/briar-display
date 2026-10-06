import { BOARD_COLS, BOARD_ROWS, COMBAT_ROWS } from '../data/rules'
import type { HexPos } from './types'

// even-r 水平错行：偶数行右移半格；cube 坐标为唯一事实来源，避免奇偶行分支出错
interface Cube {
	x: number
	y: number
	z: number
}

const toCube = (p: HexPos): Cube => {
	const x = p.col - ((p.row - (p.row & 1)) >> 1)
	const z = p.row
	return { x, y: -x - z, z }
}

const fromCube = (x: number, z: number): HexPos => ({
	col: x + ((z - (z & 1)) >> 1),
	row: z,
})

const CUBE_DIRS: [number, number][] = [
	[1, -1],
	[1, 0],
	[0, 1],
	[-1, 1],
	[-1, 0],
	[0, -1],
]

export const inCombatBounds = (p: HexPos) =>
	p.col >= 0 && p.col < BOARD_COLS && p.row >= 0 && p.row < COMBAT_ROWS

export const inPlaceBounds = (p: HexPos) =>
	p.col >= 0 && p.col < BOARD_COLS && p.row >= 0 && p.row < BOARD_ROWS

export const sameHex = (a: HexPos, b: HexPos) => a.col === b.col && a.row === b.row

export function hexDistance(a: HexPos, b: HexPos): number {
	const ca = toCube(a)
	const cb = toCube(b)
	return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y), Math.abs(ca.z - cb.z))
}

export function neighbors(p: HexPos): HexPos[] {
	const c = toCube(p)
	const out: HexPos[] = []
	for (const [dx, dz] of CUBE_DIRS) {
		const np = fromCube(c.x + dx, c.z + dz)
		if (inCombatBounds(np)) out.push(np)
	}
	return out
}

export function hexesInRange(center: HexPos, range: number): HexPos[] {
	const c = toCube(center)
	const out: HexPos[] = []
	for (let dx = -range; dx <= range; dx++) {
		for (let dy = Math.max(-range, -dx - range); dy <= Math.min(range, -dx + range); dy++) {
			const np = fromCube(c.x + dx, c.z + dx + dy)
			if (inCombatBounds(np)) out.push(np)
		}
	}
	return out
}

/** BFS 朝目标走一格；返回 null 表示完全不可达。from==to 时原地不动 */
export function stepToward(
	from: HexPos,
	to: HexPos,
	isFree: (p: HexPos) => boolean,
): HexPos | null {
	if (sameHex(from, to)) return from
	const key = (p: HexPos) => `${p.col},${p.row}`
	const prev = new Map<string, HexPos | null>()
	prev.set(key(from), null)
	const queue: HexPos[] = [from]
	while (queue.length > 0) {
		const cur = queue.shift() as HexPos
		if (sameHex(cur, to)) {
			// 回溯到 from 的下一格
			let step = cur
			let parent = prev.get(key(step))
			while (parent && !sameHex(parent, from)) {
				step = parent
				parent = prev.get(key(step)) ?? null
			}
			return step
		}
		for (const np of neighbors(cur)) {
			const k = key(np)
			if (prev.has(k)) continue
			if (!isFree(np) && !sameHex(np, to)) continue
			prev.set(k, cur)
			queue.push(np)
		}
	}
	return null
}

/** 目标点被占时，找其 range 圈内最近空格 */
export function nearestFreeInRange(
	center: HexPos,
	range: number,
	isFree: (p: HexPos) => boolean,
): HexPos | null {
	const hexes = hexesInRange(center, range)
		.filter((h) => hexDistance(h, center) >= 1)
		.sort((a, b) => hexDistance(a, center) - hexDistance(b, center))
	return hexes.find(isFree) ?? null
}

/** 放置坐标(行 0..3，0=前排) → 战斗网格行：防守方在上半区(0..3)，进攻方镜像到下半区(4..7) */
export const toCombatRow = (row: number, side: 'defender' | 'attacker') =>
	side === 'defender' ? BOARD_ROWS - 1 - row : BOARD_ROWS + row

/** UI 以玩家视角在下方展示时，对战斗网格做整体垂直翻转 */
export const flipCombatRow = (row: number) => COMBAT_ROWS - 1 - row

/** 直线六边形：from 朝 to 方向延伸至边界 */
export function lineHexes(from: HexPos, to: HexPos): HexPos[] {
	if (from.col === to.col && from.row === to.row) return [from]
	// cube 坐标步进
	const cube = (p: HexPos) => {
		const x = p.col - ((p.row - (p.row & 1)) >> 1)
		return { x, z: p.row, y: -x - p.row }
	}
	const un = (x: number, z: number): HexPos => ({ col: x + ((z - (z & 1)) >> 1), row: z })
	const a = cube(from)
	const b = cube(to)
	const dist = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z))
	const dir = { x: (b.x - a.x) / dist, y: (b.y - a.y) / dist, z: (b.z - a.z) / dist }
	const out: HexPos[] = []
	for (let i = 0; i <= 8; i++) {
		const cx = Math.round(a.x + dir.x * i)
		const cz = Math.round(a.z + dir.z * i)
		const p = un(cx, cz)
		if (p.col < 0 || p.col > 6 || p.row < 0 || p.row > 7) break
		if (!out.some((h) => h.col === p.col && h.row === p.row)) out.push(p)
	}
	return out
}
