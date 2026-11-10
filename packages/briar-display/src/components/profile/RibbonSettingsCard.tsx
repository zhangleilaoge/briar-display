'use client'

import { ProfileSheet, ProfileSheetHeader } from '@/components/profile/ProfileSheet'
import { Button } from '@/components/ui/button'
import { prefersReducedMotion, useFlip } from '@/components/ui/motion'
import { RIBBON_ITEMS, type RibbonItem } from '@/components/ui/ribbon-items'
import type { RibbonTagKind } from '@/components/ui/ribbon-tags'
import { ribbonDragOffset, ribbonInsertionIndex } from '@/components/ui/ribbonPreferences'
import { useRibbonNavigation } from '@/components/ui/useRibbonNavigation'
import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import {
	BarChart3,
	Check,
	ChevronDown,
	ChevronUp,
	Eye,
	EyeOff,
	Folder,
	GripVertical,
	Home,
	LayoutGrid,
	Lightbulb,
	Loader2,
	type LucideIcon,
	Palette,
	PanelLeft,
	ShieldCheck,
	UserRound,
} from 'lucide-react'
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react'
import { createPortal } from 'react-dom'

const ITEM_ICONS: Record<RibbonTagKind, LucideIcon> = {
	home: Home,
	style: Palette,
	tools: LayoutGrid,
	files: Folder,
	thoughts: Lightbulb,
	markets: BarChart3,
	admin: ShieldCheck,
	profile: UserRound,
}

type DragPosition = { from: number; to: number }

export function RibbonSettingsCard() {
	const { isAdmin } = usePermissions()
	const { order, canEdit, saving, add, remove, move } = useRibbonNavigation()
	const [dragged, setDragged] = useState<RibbonTagKind | null>(null)
	const [dragPosition, setDragPosition] = useState<DragPosition | null>(null)
	const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
	const [dragWidth, setDragWidth] = useState(0)
	const [announcement, setAnnouncement] = useState('')
	const listRef = useRef<HTMLUListElement>(null)
	const draggedRef = useRef<RibbonTagKind | null>(null)
	const dragPositionRef = useRef<DragPosition | null>(null)
	const pointerIdRef = useRef<number | null>(null)
	const skipNextFlipRef = useRef(false)
	const candidates = RIBBON_ITEMS.filter((item) => !item.adminOnly || isAdmin)
	const visible = order
		.map((kind) => candidates.find((item) => item.kind === kind))
		.filter((item): item is RibbonItem => Boolean(item))
	const hidden = candidates.filter((item) => !order.includes(item.kind))
	const items = [...visible, ...hidden]
	const draggedItem = dragged ? visible.find((item) => item.kind === dragged) : undefined
	useFlip(listRef, [items.map((item) => item.kind).join(',')], skipNextFlipRef, 'y')

	const finishDrag = useCallback(
		(persist: boolean) => {
			const position = dragPositionRef.current
			const kind = draggedRef.current
			if (!kind) return
			draggedRef.current = null
			dragPositionRef.current = null
			pointerIdRef.current = null
			setDragged(null)
			setDragPosition(null)
			setDragPoint(null)
			if (!persist || !position || position.from === position.to) return
			skipNextFlipRef.current = true
			if (move(position.from, position.to)) {
				const label = RIBBON_ITEMS.find((item) => item.kind === kind)?.label
				setAnnouncement(`${label}已移动到第 ${position.to + 1} 位`)
			} else {
				skipNextFlipRef.current = false
			}
		},
		[move],
	)

	useEffect(() => {
		if (!dragged) return
		const cancelOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') finishDrag(false)
		}
		document.addEventListener('keydown', cancelOnEscape)
		return () => document.removeEventListener('keydown', cancelOnEscape)
	}, [dragged, finishDrag])

	useEffect(() => {
		if (!canEdit && draggedRef.current) finishDrag(false)
	}, [canEdit, finishDrag])

	const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
		if (!canEdit || index < 0 || event.button !== 0 || draggedRef.current) return
		const item = visible[index]
		const row = event.currentTarget.closest('li')
		if (!item || !row || !listRef.current) return
		event.preventDefault()
		listRef.current.setPointerCapture(event.pointerId)
		pointerIdRef.current = event.pointerId
		draggedRef.current = item.kind
		dragPositionRef.current = { from: index, to: index }
		setDragged(item.kind)
		setDragPosition({ from: index, to: index })
		const bounds = row.getBoundingClientRect()
		setDragPoint({ x: bounds.left + bounds.width / 2, y: event.clientY })
		setDragWidth(bounds.width)
	}

	const previewDrag = (event: ReactPointerEvent<HTMLUListElement>) => {
		const kind = draggedRef.current
		const list = listRef.current
		const position = dragPositionRef.current
		if (!kind || !list || !position || pointerIdRef.current !== event.pointerId) return
		event.preventDefault()
		setDragPoint((current) => (current ? { ...current, y: event.clientY } : null))
		const pointerY = event.clientY - list.getBoundingClientRect().top + list.scrollTop
		const siblings = Array.from(
			list.querySelectorAll<HTMLLIElement>(':scope > li[data-flip-key][data-shown="true"]'),
		).filter((element) => element.dataset.flipKey !== kind)
		const midpoints = siblings.map((element) => element.offsetTop + element.offsetHeight / 2)
		const to = ribbonInsertionIndex(pointerY, midpoints)
		if (to === position.to) return
		const next = { from: position.from, to }
		dragPositionRef.current = next
		setDragPosition(next)
	}

	const finishPointer = (event: ReactPointerEvent<HTMLUListElement>, persist: boolean) => {
		if (pointerIdRef.current !== event.pointerId) return
		finishDrag(persist)
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId)
		}
	}

	const moveBy = (index: number, delta: -1 | 1) => {
		if (index < 0) return
		const target = visible[index + delta]
		const item = visible[index]
		if (!target || !item || !move(index, index + delta)) return
		setAnnouncement(`${item.label}已移动到第 ${index + delta + 1} 位`)
	}

	const moveWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
		if (!event.altKey) return
		const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
		if (!delta) return
		event.preventDefault()
		moveBy(index, delta)
	}

	return (
		<ProfileSheet bodyClassName="space-y-4">
			<ProfileSheetHeader
				icon={<PanelLeft className="h-4 w-4" />}
				title="侧边菜单"
				description="拖动卡片编排导航，变更会自动保存并同步到左侧栏"
				actions={
					<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
						{saving ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
						) : (
							<Check className="h-3.5 w-3.5" aria-hidden />
						)}
						{saving ? '保存中' : '自动保存'}
					</span>
				}
			/>

			<div className="flex items-center justify-between px-1">
				<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					导航顺序
				</p>
				<span className="text-xs tabular-nums text-muted-foreground">
					{visible.length} / {items.length} 个已显示
				</span>
			</div>
			<ul
				ref={listRef}
				className="relative space-y-2"
				data-testid="ribbon-settings-list"
				onPointerMoveCapture={previewDrag}
				onPointerUp={(event) => finishPointer(event, true)}
				onPointerCancel={(event) => finishPointer(event, false)}
				onLostPointerCapture={(event) => finishPointer(event, false)}
			>
				{items.map((item) => {
					const shown = order.includes(item.kind)
					const itemIndex = visible.findIndex((visibleItem) => visibleItem.kind === item.kind)
					const isDragged = dragged === item.kind
					const dragOffset =
						shown && dragPosition
							? ribbonDragOffset(itemIndex, dragPosition.from, dragPosition.to)
							: 0
					return (
						<li
							key={item.kind}
							data-flip-key={item.kind}
							data-shown={shown}
							className={cn(
								'group relative flex h-16 items-center gap-2 rounded-control border px-2.5 motion-safe:transition-[transform,border-color,box-shadow,background-color] motion-safe:duration-200',
								shown
									? 'border-border/50 bg-card/65 shadow-surface'
									: 'border-border/30 bg-muted/25 text-muted-foreground shadow-none',
								shown &&
									!isDragged &&
									'hover:border-primary/30 hover:bg-card focus-within:border-primary/40 focus-within:shadow-control',
								isDragged && 'border-dashed border-primary/40 bg-accent/35 shadow-none',
							)}
							style={{
								transform:
									dragOffset === 0
										? undefined
										: `translateY(calc(${dragOffset * 100}% + ${dragOffset * 8}px))`,
							}}
						>
							{isDragged ? (
								<div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
									<GripVertical className="h-4 w-4" aria-hidden />
									放在这里
								</div>
							) : (
								<>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="-ml-1 h-9 w-7 cursor-grab px-0 text-muted-foreground [touch-action:none] hover:bg-transparent active:cursor-grabbing"
										disabled={!canEdit || !shown}
										aria-label={`拖动${item.label}，也可按 Alt 加上下方向键排序`}
										aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
										onPointerDown={(event) => startDrag(event, itemIndex)}
										onKeyDown={(event) => moveWithKeyboard(event, itemIndex)}
									>
										<GripVertical className="h-4 w-4" aria-hidden />
									</Button>
									<ItemIdentity item={item} index={shown ? itemIndex : null} muted={!shown} />
									<div className="flex shrink-0 items-center gap-0.5 transition-opacity max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											className="h-8 w-7 px-0"
											aria-label={`${item.label}上移`}
											disabled={!canEdit || !shown || itemIndex === 0}
											onClick={() => moveBy(itemIndex, -1)}
										>
											<ChevronUp className="h-4 w-4" aria-hidden />
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											className="h-8 w-7 px-0"
											aria-label={`${item.label}下移`}
											disabled={!canEdit || !shown || itemIndex === visible.length - 1}
											onClick={() => moveBy(itemIndex, 1)}
										>
											<ChevronDown className="h-4 w-4" aria-hidden />
										</Button>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										className="h-9 w-9 px-0 text-muted-foreground hover:text-foreground"
										disabled={!canEdit || (shown && visible.length <= 1)}
										aria-label={`${shown ? '隐藏' : '显示'}${item.label}`}
										title={
											shown && visible.length <= 1
												? '至少保留一个标签'
												: `${shown ? '隐藏' : '显示'}${item.label}`
										}
										onClick={() => (shown ? remove(item.kind) : add(item.kind))}
									>
										{shown ? (
											<Eye className="h-4 w-4" aria-hidden />
										) : (
											<EyeOff className="h-4 w-4" aria-hidden />
										)}
									</Button>
								</>
							)}
						</li>
					)
				})}
			</ul>

			<p className="text-xs text-muted-foreground">
				点击眼睛切换显隐，也可按 Alt + ↑↓ 排序；至少保留一个标签，重新显示的标签会排到最后。
			</p>
			<p className="sr-only" aria-live="polite">
				{announcement}
			</p>
			{draggedItem &&
				dragPoint &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						aria-hidden
						className="pointer-events-none fixed z-[100] flex h-16 items-center gap-2 rounded-control border border-primary/35 bg-card px-2.5 shadow-control-hover"
						style={{
							left: dragPoint.x,
							top: dragPoint.y,
							width: dragWidth,
							transform: `translate(-50%, -50%)${prefersReducedMotion() ? '' : ' scale(1.02)'}`,
						}}
					>
						<GripVertical className="h-4 w-4 text-muted-foreground" />
						<ItemIdentity item={draggedItem} index={dragPosition?.from ?? 0} />
						<Eye className="h-4 w-4 text-muted-foreground" />
					</div>,
					document.body,
				)}
		</ProfileSheet>
	)
}

function ItemIdentity({
	item,
	index,
	muted = false,
}: {
	item: RibbonItem
	index: number | null
	muted?: boolean
}) {
	const Icon = ITEM_ICONS[item.kind]
	return (
		<div className={cn('flex min-w-0 flex-1 items-center gap-3', muted && 'opacity-55')}>
			<span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
				{index === null ? '—' : String(index + 1).padStart(2, '0')}
			</span>
			<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-border/50 bg-accent/35 text-foreground">
				<Icon className="h-4 w-4" aria-hidden />
			</span>
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">{item.label}</p>
				<p className="truncate font-label text-[10px] uppercase tracking-wider text-muted-foreground">
					{item.caption}
				</p>
			</div>
		</div>
	)
}
