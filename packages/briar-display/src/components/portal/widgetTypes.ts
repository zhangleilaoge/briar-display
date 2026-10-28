/** 门户桌面小组件：iOS/macOS 风格网格尺寸、默认布局、localStorage */

export type WidgetId = 'calendar' | 'clock' | 'stocks' | 'weather' | 'greeting'

/** 网格占位：宽×高（列×行），桌面 4 列 / 窄屏 2 列 */
export type WidgetSize = '1x1' | '2x2' | '4x2' | '2x4'

export interface SizeSpec {
	w: number
	h: number
	label: string
}

export const SIZE_SPECS: Record<WidgetSize, SizeSpec> = {
	'1x1': { w: 1, h: 1, label: '小' },
	'2x2': { w: 2, h: 2, label: '中' },
	'4x2': { w: 4, h: 2, label: '宽' },
	'2x4': { w: 2, h: 4, label: '高' },
}

export interface WidgetPlacement {
	id: WidgetId
	size: WidgetSize
	/** 0-based 列；-1 表示由打包器自动放置 */
	col: number
	/** 0-based 行 */
	row: number
}

export interface WidgetMeta {
	id: WidgetId
	title: string
	caption: string
	description: string
	sizes: WidgetSize[]
	defaultSize: WidgetSize
}

export const WIDGET_CATALOG: WidgetMeta[] = [
	{
		id: 'greeting',
		title: '今日问候',
		caption: 'Bonjour',
		description: '按上海日历日轮换的一句问候',
		sizes: ['2x2', '4x2'],
		defaultSize: '2x2',
	},
	{
		id: 'calendar',
		title: '日历',
		caption: 'Calendrier',
		description: '本月视图，高亮今天（上海时区）',
		sizes: ['2x2'],
		defaultSize: '2x2',
	},
	{
		id: 'clock',
		title: '时钟',
		caption: 'Horloge',
		description: '实时时间与日期',
		sizes: ['1x1', '2x2'],
		defaultSize: '1x1',
	},
	{
		id: 'weather',
		title: '天气',
		caption: 'Météo',
		description: '杭州实时天气',
		sizes: ['2x2', '1x1'],
		defaultSize: '2x2',
	},
	{
		id: 'stocks',
		title: '自选股',
		caption: 'Actions',
		description: '自选股行情轮播',
		sizes: ['4x2', '2x4', '2x2'],
		defaultSize: '4x2',
	},
]

export const WIDGET_META: Record<WidgetId, WidgetMeta> = Object.fromEntries(
	WIDGET_CATALOG.map((m) => [m.id, m]),
) as Record<WidgetId, WidgetMeta>

/**
 * 默认桌面（4 列；问候由明信片承担，不在默认布局）：
 *  [日历 2×2] [天气 2×2]
 *  [钟 1×1]
 *  [自选 4×2]
 */
export const DEFAULT_LAYOUT: WidgetPlacement[] = [
	{ id: 'calendar', size: '2x2', col: 0, row: 0 },
	{ id: 'weather', size: '2x2', col: 2, row: 0 },
	{ id: 'clock', size: '1x1', col: 0, row: 2 },
	{ id: 'stocks', size: '4x2', col: 0, row: 3 },
]

export const LAYOUT_STORAGE_KEY = 'briar_portal_widgets_v1'

export const GRID_COLS_DESKTOP = 4
export const GRID_COLS_MOBILE = 2

const VALID_IDS = new Set<string>(WIDGET_CATALOG.map((m) => m.id))
const VALID_SIZES = new Set<string>(Object.keys(SIZE_SPECS))

function clampSize(id: WidgetId, size: unknown): WidgetSize {
	const meta = WIDGET_META[id]
	if (
		typeof size === 'string' &&
		VALID_SIZES.has(size) &&
		meta.sizes.includes(size as WidgetSize)
	) {
		return size as WidgetSize
	}
	return meta.defaultSize
}

export function parseStoredLayout(raw: string | null): WidgetPlacement[] | null {
	if (!raw) return null
	try {
		const data = JSON.parse(raw) as unknown
		if (!Array.isArray(data)) return null
		const seen = new Set<string>()
		const out: WidgetPlacement[] = []
		for (const row of data) {
			if (!row || typeof row !== 'object') continue
			const id = (row as { id?: unknown }).id
			if (typeof id !== 'string' || !VALID_IDS.has(id) || seen.has(id)) continue
			seen.add(id)
			const size = clampSize(id as WidgetId, (row as { size?: unknown }).size)
			const col = Number((row as { col?: unknown }).col)
			const r = Number((row as { row?: unknown }).row)
			out.push({
				id: id as WidgetId,
				size,
				col: Number.isFinite(col) && col >= 0 ? Math.floor(col) : -1,
				row: Number.isFinite(r) && r >= 0 ? Math.floor(r) : -1,
			})
		}
		return out.length ? out : null
	} catch {
		return null
	}
}

/** 窄屏把超宽尺寸压成可放进 2 列的规格 */
export function mobileSize(size: WidgetSize): WidgetSize {
	const spec = SIZE_SPECS[size]
	if (spec.w > GRID_COLS_MOBILE) return '2x2'
	return size
}

/**
 * 首次适配装箱：按顺序把未定位或冲突的部件放进网格。
 * 已有合法位置且不重叠的保留。
 */
export function packLayout(
	items: WidgetPlacement[],
	cols: number,
	adaptSize: (s: WidgetSize) => WidgetSize = (s) => s,
): WidgetPlacement[] {
	const occupied = new Set<string>()
	const key = (c: number, r: number) => `${c},${r}`
	const mark = (c: number, r: number, w: number, h: number) => {
		for (let y = r; y < r + h; y++) {
			for (let x = c; x < c + w; x++) occupied.add(key(x, y))
		}
	}
	const fits = (c: number, r: number, w: number, h: number) => {
		if (c < 0 || r < 0 || c + w > cols) return false
		for (let y = r; y < r + h; y++) {
			for (let x = c; x < c + w; x++) {
				if (occupied.has(key(x, y))) return false
			}
		}
		return true
	}
	const findSpot = (w: number, h: number): { col: number; row: number } => {
		for (let r = 0; r < 64; r++) {
			for (let c = 0; c <= cols - w; c++) {
				if (fits(c, r, w, h)) return { col: c, row: r }
			}
		}
		return { col: 0, row: 0 }
	}

	const result: WidgetPlacement[] = []
	for (const item of items) {
		const size = adaptSize(item.size)
		const { w, h } = SIZE_SPECS[size]
		let col = item.col
		let row = item.row
		if (col < 0 || row < 0 || !fits(col, row, w, h)) {
			const spot = findSpot(w, h)
			col = spot.col
			row = spot.row
		}
		mark(col, row, w, h)
		result.push({ id: item.id, size, col, row })
	}
	return result
}

/** 拖到某格：尝试把 widget 放到最近可吸附的合法格 */
export function snapPlacement(
	layout: WidgetPlacement[],
	id: WidgetId,
	targetCol: number,
	targetRow: number,
	cols: number,
): WidgetPlacement[] {
	const item = layout.find((p) => p.id === id)
	if (!item) return layout
	const { w, h } = SIZE_SPECS[item.size]
	const col = Math.max(0, Math.min(cols - w, Math.round(targetCol)))
	const row = Math.max(0, Math.round(targetRow))

	const others = layout.filter((p) => p.id !== id)
	const occupied = new Set<string>()
	for (const o of others) {
		const s = SIZE_SPECS[o.size]
		for (let y = o.row; y < o.row + s.h; y++) {
			for (let x = o.col; x < o.col + s.w; x++) occupied.add(`${x},${y}`)
		}
	}
	const free = (c: number, r: number) => {
		if (c < 0 || r < 0 || c + w > cols) return false
		for (let y = r; y < r + h; y++) {
			for (let x = c; x < c + w; x++) if (occupied.has(`${x},${y}`)) return false
		}
		return true
	}
	if (free(col, row)) return others.concat([{ ...item, col, row }])
	for (let rad = 1; rad <= 6; rad++) {
		for (let dr = -rad; dr <= rad; dr++) {
			for (let dc = -rad; dc <= rad; dc++) {
				const c = col + dc
				const r = row + dr
				if (free(c, r)) return others.concat([{ ...item, col: c, row: r }])
			}
		}
	}
	return layout
}

export function gridItemStyle(placement: WidgetPlacement): {
	gridColumn: string
	gridRow: string
} {
	const { w, h } = SIZE_SPECS[placement.size]
	return {
		gridColumn: `${placement.col + 1} / span ${w}`,
		gridRow: `${placement.row + 1} / span ${h}`,
	}
}
