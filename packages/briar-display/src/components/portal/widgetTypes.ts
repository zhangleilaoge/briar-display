/** 门户桌面小组件：以 1×1 为单元，尺寸克制，桌面/手机分存 */

export type WidgetId = 'calendar' | 'clock' | 'stocks' | 'weather' | 'greeting'

/**
 * 网格占位：宽×高（列×行）
 * - 1×1 小（主尺寸，对齐 macOS small）
 * - 2×1 中（横向）
 * - 2×2 大
 * 不再提供 4×2 / 2×4 等过宽过高规格，避免过于灵活。
 */
export type WidgetSize = '1x1' | '2x1' | '2x2'

export interface SizeSpec {
	w: number
	h: number
	label: string
}

export const SIZE_SPECS: Record<WidgetSize, SizeSpec> = {
	'1x1': { w: 1, h: 1, label: '小' },
	'2x1': { w: 2, h: 1, label: '中' },
	'2x2': { w: 2, h: 2, label: '大' },
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
		sizes: ['1x1', '2x2'],
		defaultSize: '1x1',
	},
	{
		id: 'calendar',
		title: '日历',
		caption: 'Calendrier',
		description: '本月视图，高亮今天（上海时区）',
		sizes: ['1x1', '2x2'],
		defaultSize: '1x1',
	},
	{
		id: 'clock',
		title: '时钟',
		caption: 'Horloge',
		description: '古典指针表盘与实时数字时间',
		sizes: ['1x1', '2x2'],
		defaultSize: '1x1',
	},
	{
		id: 'weather',
		title: '天气',
		caption: 'Météo',
		description: '多地区实时天气、逐小时与七日预报',
		sizes: ['1x1', '2x1', '2x2'],
		defaultSize: '1x1',
	},
	{
		id: 'stocks',
		title: '自选股',
		caption: 'Actions',
		description: '单标的行情轮播（价 + 涨跌 + 走势）',
		sizes: ['1x1', '2x1'],
		defaultSize: '1x1',
	},
]

export const WIDGET_META: Record<WidgetId, WidgetMeta> = Object.fromEntries(
	WIDGET_CATALOG.map((m) => [m.id, m]),
) as Record<WidgetId, WidgetMeta>

/**
 * 默认桌面（4 列；问候由明信片承担，不在默认布局）：
 *  全部 1×1：日历 / 天气 / 时钟 / 自选
 *  编辑模式仍可选 2×1 / 2×2
 */
export const DEFAULT_LAYOUT_DESKTOP: WidgetPlacement[] = [
	{ id: 'calendar', size: '1x1', col: 0, row: 0 },
	{ id: 'weather', size: '1x1', col: 1, row: 0 },
	{ id: 'clock', size: '1x1', col: 2, row: 0 },
	{ id: 'stocks', size: '1x1', col: 3, row: 0 },
]

/** 默认手机（2 列）：全 1×1 */
export const DEFAULT_LAYOUT_MOBILE: WidgetPlacement[] = [
	{ id: 'calendar', size: '1x1', col: 0, row: 0 },
	{ id: 'weather', size: '1x1', col: 1, row: 0 },
	{ id: 'clock', size: '1x1', col: 0, row: 1 },
	{ id: 'stocks', size: '1x1', col: 1, row: 1 },
]

/** @deprecated 兼容旧引用 */
export const DEFAULT_LAYOUT = DEFAULT_LAYOUT_DESKTOP

/** 桌面 / 手机分存，互不覆盖 */
/** v3：默认全 1×1； bump 以丢弃 v2 里偏大的出厂布局 */
export const LAYOUT_STORAGE_KEY_DESKTOP = 'briar_portal_widgets_desktop_v3'
export const LAYOUT_STORAGE_KEY_MOBILE = 'briar_portal_widgets_mobile_v3'
/** 旧版 key，仅作首次迁移读取（v2 / 更早） */
export const LAYOUT_STORAGE_KEY_LEGACY = 'briar_portal_widgets_v1'
export const LAYOUT_STORAGE_KEY_DESKTOP_V2 = 'briar_portal_widgets_desktop_v2'
export const LAYOUT_STORAGE_KEY_MOBILE_V2 = 'briar_portal_widgets_mobile_v2'
export const LAYOUT_STORAGE_KEY = LAYOUT_STORAGE_KEY_DESKTOP

export const GRID_COLS_DESKTOP = 4
export const GRID_COLS_MOBILE = 2

/** 单元边长（rem）。1×1 贴近 macOS small，不再过小 */
export const CELL_REM_DESKTOP = 10.5
export const CELL_REM_MOBILE = 9.5
/** 宽屏时单元格最大拉伸倍数（相对单元边长） */
export const CELL_MAX_STRETCH = 1.5

const VALID_IDS = new Set<string>(WIDGET_CATALOG.map((m) => m.id))
const VALID_SIZES = new Set<string>(Object.keys(SIZE_SPECS))

/** 旧尺寸 → 新尺寸 */
const LEGACY_SIZE_MAP: Record<string, WidgetSize> = {
	'1x1': '1x1',
	'2x1': '2x1',
	'2x2': '2x2',
	'4x2': '2x1',
	'2x4': '2x2',
}

function clampSize(id: WidgetId, size: unknown): WidgetSize {
	const meta = WIDGET_META[id]
	const mapped =
		typeof size === 'string'
			? (LEGACY_SIZE_MAP[size] ?? (VALID_SIZES.has(size) ? size : null))
			: null
	if (mapped && meta.sizes.includes(mapped as WidgetSize)) return mapped as WidgetSize
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
		/* 显式 [] 表示用户清空桌面，勿回落到出厂默认 */
		return out
	} catch {
		return null
	}
}

export function storageKeyForCols(cols: number): string {
	return cols === GRID_COLS_MOBILE ? LAYOUT_STORAGE_KEY_MOBILE : LAYOUT_STORAGE_KEY_DESKTOP
}

export function defaultLayoutForCols(cols: number): WidgetPlacement[] {
	return cols === GRID_COLS_MOBILE ? DEFAULT_LAYOUT_MOBILE : DEFAULT_LAYOUT_DESKTOP
}

/** 窄屏把超宽尺寸压进 2 列（现规格里 2×1 / 2×2 已可放下，仅兜底） */
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
