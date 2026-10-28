'use client'

import { cn } from '@/lib/utils'
import {
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import {
	DEFAULT_LAYOUT,
	GRID_COLS_DESKTOP,
	GRID_COLS_MOBILE,
	LAYOUT_STORAGE_KEY,
	SIZE_SPECS,
	WIDGET_CATALOG,
	WIDGET_META,
	type WidgetId,
	type WidgetPlacement,
	type WidgetSize,
	gridItemStyle,
	mobileSize,
	packLayout,
	parseStoredLayout,
	snapPlacement,
} from './widgetTypes'
import { CalendarWidget } from './widgets/CalendarWidget'
import { ClockWidget } from './widgets/ClockWidget'
import { GreetingWidget } from './widgets/GreetingWidget'
import { StocksWidget } from './widgets/StocksWidget'
import { WeatherWidget } from './widgets/WeatherWidget'

function renderWidget(id: WidgetId, size: WidgetSize, editing: boolean, onRemove: () => void) {
	const props = { size, editing, onRemove }
	switch (id) {
		case 'calendar':
			return <CalendarWidget {...props} />
		case 'clock':
			return <ClockWidget {...props} />
		case 'weather':
			return <WeatherWidget {...props} />
		case 'stocks':
			return <StocksWidget {...props} />
		case 'greeting':
			return <GreetingWidget {...props} />
		default:
			return null
	}
}

function useGridCols() {
	const [cols, setCols] = useState(GRID_COLS_DESKTOP)
	useEffect(() => {
		const mq = window.matchMedia('(max-width: 639px)')
		const apply = () => setCols(mq.matches ? GRID_COLS_MOBILE : GRID_COLS_DESKTOP)
		apply()
		mq.addEventListener('change', apply)
		return () => mq.removeEventListener('change', apply)
	}, [])
	return cols
}

function persist(layout: WidgetPlacement[]) {
	try {
		window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
	} catch {
		/* ignore quota */
	}
}

export function WidgetDesktop() {
	const cols = useGridCols()
	const [editing, setEditing] = useState(false)
	const [hydrated, setHydrated] = useState(false)
	const [layout, setLayout] = useState<WidgetPlacement[]>(DEFAULT_LAYOUT)
	const [pickerOpen, setPickerOpen] = useState(false)
	const gridRef = useRef<HTMLDivElement>(null)
	const dragRef = useRef<{
		id: WidgetId
		originCol: number
		originRow: number
		pointerId: number
		startX: number
		startY: number
	} | null>(null)
	const [draggingId, setDraggingId] = useState<WidgetId | null>(null)

	// hydrate from localStorage after mount（避免 SSR/CSR 不一致）
	useEffect(() => {
		const stored = parseStoredLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY))
		const base = stored ?? DEFAULT_LAYOUT
		const adapt = cols === GRID_COLS_MOBILE ? mobileSize : (s: WidgetSize) => s
		setLayout(packLayout(base, cols, adapt))
		setHydrated(true)
	}, [])

	// 列数变化时重新打包（保留相对意图）
	useEffect(() => {
		if (!hydrated) return
		const adapt = cols === GRID_COLS_MOBILE ? mobileSize : (s: WidgetSize) => s
		setLayout((prev) => packLayout(prev, cols, adapt))
	}, [cols, hydrated])

	const commit = useCallback((next: WidgetPlacement[]) => {
		setLayout(next)
		persist(next)
	}, [])

	const remove = (id: WidgetId) => {
		commit(layout.filter((p) => p.id !== id))
	}

	const add = (id: WidgetId, size?: WidgetSize) => {
		if (layout.some((p) => p.id === id)) return
		const meta = WIDGET_META[id]
		const chosen = size && meta.sizes.includes(size) ? size : meta.defaultSize
		const adapted = cols === GRID_COLS_MOBILE ? mobileSize(chosen) : chosen
		commit(packLayout([...layout, { id, size: adapted, col: -1, row: -1 }], cols))
		setPickerOpen(false)
	}

	const resize = (id: WidgetId, size: WidgetSize) => {
		const next = layout.map((p) => (p.id === id ? { ...p, size, col: -1, row: -1 } : p))
		commit(packLayout(next, cols, cols === GRID_COLS_MOBILE ? mobileSize : (s) => s))
	}

	const reset = () => {
		const adapt = cols === GRID_COLS_MOBILE ? mobileSize : (s: WidgetSize) => s
		commit(packLayout(DEFAULT_LAYOUT, cols, adapt))
	}

	const missing = useMemo(
		() => WIDGET_CATALOG.filter((m) => !layout.some((p) => p.id === m.id)),
		[layout],
	)

	const onPointerDown = (e: ReactPointerEvent, id: WidgetId) => {
		if (!editing) return
		if ((e.target as HTMLElement).closest('button,a,input')) return
		const item = layout.find((p) => p.id === id)
		if (!item) return
		e.currentTarget.setPointerCapture(e.pointerId)
		dragRef.current = {
			id,
			originCol: item.col,
			originRow: item.row,
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
		}
		setDraggingId(id)
	}

	const onPointerMove = (e: ReactPointerEvent) => {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== e.pointerId || !gridRef.current) return
		const rect = gridRef.current.getBoundingClientRect()
		const styles = getComputedStyle(gridRef.current)
		const gap = Number.parseFloat(styles.columnGap || styles.gap || '12') || 12
		const cellW = (rect.width - gap * (cols - 1)) / cols
		const rowH =
			Number.parseFloat(styles.gridAutoRows || '') ||
			Number.parseFloat(styles.getPropertyValue('--rv-widget-cell') || '') ||
			cellW
		const x = e.clientX - rect.left
		const y = e.clientY - rect.top
		const targetCol = x / (cellW + gap)
		const targetRow = y / (rowH + gap)
		const next = snapPlacement(layout, drag.id, targetCol, targetRow, cols)
		// 仅在位置变化时更新，避免每帧 persist
		const cur = layout.find((p) => p.id === drag.id)
		const moved = next.find((p) => p.id === drag.id)
		if (cur && moved && (cur.col !== moved.col || cur.row !== moved.row)) {
			setLayout(next)
		}
	}

	const onPointerUp = (e: ReactPointerEvent) => {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== e.pointerId) return
		dragRef.current = null
		setDraggingId(null)
		persist(layout)
	}

	// 计算网格行数
	const rowCount = useMemo(() => {
		let max = 2
		for (const p of layout) {
			max = Math.max(max, p.row + SIZE_SPECS[p.size].h)
		}
		return max
	}, [layout])

	return (
		<section aria-label="桌面小组件" className="space-y-4">
			{!hydrated ? (
				<div
					className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
					style={{ gridAutoRows: 'minmax(7.5rem, auto)' }}
					aria-hidden
				>
					{Array.from({ length: 4 }).map((_, i) => (
						<div
							key={i}
							className="col-span-2 h-36 animate-pulse rounded-[1.35rem] bg-[color:var(--rv-navy)]/8 sm:h-44"
						/>
					))}
				</div>
			) : (
				<div
					ref={gridRef}
					className={cn(
						'relative grid gap-3 sm:gap-4',
						cols === GRID_COLS_MOBILE ? 'grid-cols-2' : 'grid-cols-4',
						editing && 'rounded-2xl bg-[color:var(--rv-navy)]/[0.03] p-2 sm:p-3',
					)}
					style={
						{
							'--rv-widget-cell': cols === GRID_COLS_MOBILE ? '7.25rem' : '8.5rem',
							gridAutoRows: 'var(--rv-widget-cell)',
							minHeight: `calc(var(--rv-widget-cell) * ${rowCount})`,
						} as CSSProperties
					}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
				>
					{layout.map((p) => (
						<div
							key={p.id}
							data-widget={p.id}
							style={gridItemStyle(p)}
							className={cn(
								'touch-none select-none',
								editing && 'cursor-grab active:cursor-grabbing',
								draggingId === p.id && 'z-10 opacity-90',
							)}
							onPointerDown={(e) => onPointerDown(e, p.id)}
						>
							{renderWidget(p.id, p.size, editing, () => remove(p.id))}
							{editing && WIDGET_META[p.id].sizes.length > 1 && (
								<div className="absolute bottom-2 right-2 z-[2] flex gap-1">
									{WIDGET_META[p.id].sizes.map((s) => (
										<button
											key={s}
											type="button"
											onClick={(e) => {
												e.stopPropagation()
												resize(p.id, cols === GRID_COLS_MOBILE ? mobileSize(s) : s)
											}}
											className={cn(
												'rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
												p.size === s || (cols === GRID_COLS_MOBILE && mobileSize(s) === p.size)
													? 'border-[color:var(--rv-rose)] bg-[var(--rv-pink)] text-[color:var(--rv-ink)]'
													: 'border-[color:var(--rv-navy)]/20 bg-[var(--rv-cream)]/90 text-muted-foreground',
											)}
											aria-label={`尺寸 ${SIZE_SPECS[s].label}`}
										>
											{SIZE_SPECS[s].label}
										</button>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			)}

			{/* iOS 风格：编辑小组件 / 完成 */}
			<div className="flex flex-wrap items-center justify-center gap-2 pt-1">
				{!editing ? (
					<button
						type="button"
						onClick={() => setEditing(true)}
						className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--rv-navy)]/20 bg-[color-mix(in_srgb,var(--rv-cream)_88%,var(--rv-pink))] px-4 py-1.5 text-sm font-medium text-foreground shadow-[0_1px_0_hsl(0_0%_100%/0.8)_inset,0_4px_12px_-6px_hsl(221_46%_20%/0.25)] transition hover:-translate-y-0.5"
					>
						编辑桌面
					</button>
				) : (
					<>
						<button
							type="button"
							onClick={() => setPickerOpen((v) => !v)}
							disabled={missing.length === 0}
							className="inline-flex items-center rounded-full border border-[color:var(--rv-navy)]/20 bg-[var(--rv-cream)] px-3.5 py-1.5 text-sm disabled:opacity-40"
						>
							添加组件
						</button>
						<button
							type="button"
							onClick={reset}
							className="inline-flex items-center rounded-full border border-[color:var(--rv-navy)]/15 px-3.5 py-1.5 text-sm text-muted-foreground"
						>
							恢复默认
						</button>
						<button
							type="button"
							onClick={() => {
								setEditing(false)
								setPickerOpen(false)
								persist(layout)
							}}
							className="inline-flex items-center rounded-full border border-[color:var(--rv-rose)]/40 bg-[var(--rv-pink)] px-4 py-1.5 text-sm font-semibold text-[color:var(--rv-ink)]"
						>
							完成
						</button>
					</>
				)}
			</div>

			{editing && pickerOpen && missing.length > 0 && (
				<div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--rv-navy)]/15 bg-[var(--rv-cream)] p-3 shadow-raised sm:p-4">
					<p className="rv-label mb-2 text-muted-foreground">添加小组件</p>
					<ul className="space-y-2">
						{missing.map((m) => (
							<li key={m.id} className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate font-heading text-sm font-semibold">
										<span className="rv-script mr-1.5 text-[color:var(--rv-rose-deep)]">
											{m.caption}
										</span>
										{m.title}
									</p>
									<p className="truncate text-xs text-muted-foreground">{m.description}</p>
								</div>
								<button
									type="button"
									onClick={() => add(m.id)}
									className="shrink-0 rounded-full border border-[color:var(--rv-rose)]/40 bg-[var(--rv-pink)] px-3 py-1 text-xs font-semibold"
								>
									添加
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			{editing && (
				<p className="text-center text-[11px] text-muted-foreground">
					拖动卡片吸附到网格 · 左上角 − 移除 · 右下角切换尺寸
				</p>
			)}
		</section>
	)
}
