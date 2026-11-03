'use client'

import { useNavigate } from '@/components/common/SectionRouter'
import { cn } from '@/lib/utils'
import { Lock, LockOpen, Plus, X } from 'lucide-react'
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from './badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card'
import { prefersReducedMotion, useFlip } from './motion'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import type { RibbonItem } from './ribbon-items'
import { type RibbonTagKind, RibbonTagPreview } from './ribbon-tags'
import { ribbonDragOffset, ribbonInsertionIndex } from './ribbonPreferences'

const LONG_PRESS_MS = 500
const REMOVE_MS = 180
const DRAG_THRESHOLD = 5

interface DesktopRibbonNavProps {
	items: RibbonItem[]
	candidates: RibbonItem[]
	active: string | null
	expanded: boolean
	canEdit: boolean
	locked: boolean
	canLock: boolean
	onToggleLock: () => void
	onAdd: (kind: RibbonTagKind) => boolean
	onRemove: (kind: RibbonTagKind) => boolean
	onMove: (from: number, to: number) => boolean
	onDiscard: () => void
	onDraggingChange: (dragging: boolean) => void
}

export function DesktopRibbonNav({
	items,
	candidates,
	active,
	expanded,
	canEdit,
	locked,
	canLock,
	onToggleLock,
	onAdd,
	onRemove,
	onMove,
	onDiscard,
	onDraggingChange,
}: DesktopRibbonNavProps) {
	const [editing, setEditing] = useState(false)
	const [hovered, setHovered] = useState<RibbonTagKind | null>(null)
	const [addOpen, setAddOpen] = useState(false)
	const [removing, setRemoving] = useState<RibbonTagKind | null>(null)
	const [settling, setSettling] = useState<RibbonTagKind | null>(null)
	const [dragged, setDragged] = useState<RibbonTagKind | null>(null)
	const [dragPosition, setDragPosition] = useState<{ from: number; to: number } | null>(null)
	const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
	const listRef = useRef<HTMLUListElement>(null)
	const addContentRef = useRef<HTMLDivElement>(null)
	const pressTimerRef = useRef<number | null>(null)
	const removeTimerRef = useRef<number | null>(null)
	const pressPointRef = useRef({ x: 0, y: 0 })
	const pressStartedAtRef = useRef(0)
	const suppressClickRef = useRef(false)
	const draggedRef = useRef<RibbonTagKind | null>(null)
	const dragPositionRef = useRef<{ from: number; to: number } | null>(null)
	const skipNextFlipRef = useRef(false)
	const dragCandidateRef = useRef<{
		pointerId: number
		kind: RibbonTagKind
		x: number
		y: number
	} | null>(null)
	const expandedRef = useRef(expanded)
	expandedRef.current = expanded
	const navigate = useNavigate()
	useFlip(listRef, [items.map((item) => item.kind).join(',')], skipNextFlipRef, 'y')

	const clearPress = () => {
		if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current)
		pressTimerRef.current = null
	}

	useEffect(() => {
		if (!settling) return
		const timer = window.setTimeout(() => setSettling(null), 180)
		return () => window.clearTimeout(timer)
	}, [settling])

	useEffect(() => {
		return () => {
			clearPress()
			if (removeTimerRef.current !== null) window.clearTimeout(removeTimerRef.current)
			if (draggedRef.current) onDraggingChange(false)
		}
	}, [onDraggingChange])

	useEffect(() => {
		if ((expanded && canEdit) || !editing) return
		setEditing(false)
		setAddOpen(false)
		if (draggedRef.current) onDraggingChange(false)
		dragCandidateRef.current = null
		draggedRef.current = null
		dragPositionRef.current = null
		setDragged(null)
		setDragPosition(null)
		setDragPoint(null)
		clearPress()
		onDiscard()
	}, [canEdit, editing, expanded, onDiscard, onDraggingChange])

	useEffect(() => {
		if (!editing) return
		const finishEditing = () => {
			setEditing(false)
			setAddOpen(false)
		}
		const closeOnEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key === 'Escape') finishEditing()
		}
		const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
			const target = event.target
			if (!(target instanceof Node)) return
			const sidebar = listRef.current?.closest('nav')
			if (sidebar?.contains(target) || addContentRef.current?.contains(target)) return
			finishEditing()
		}
		document.addEventListener('keydown', closeOnEscape)
		document.addEventListener('pointerdown', closeOnOutsidePointer, true)
		return () => {
			document.removeEventListener('keydown', closeOnEscape)
			document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
		}
	}, [editing])

	const previewDrag = (clientY: number) => {
		const kind = draggedRef.current
		const list = listRef.current
		const position = dragPositionRef.current
		if (!kind || !list || !position) return
		const pointerY = clientY - list.getBoundingClientRect().top + list.scrollTop
		const siblings = Array.from(
			list.querySelectorAll<HTMLLIElement>(':scope > li[data-flip-key]'),
		).filter((element) => element.dataset.flipKey !== kind)
		const midpoints = siblings.map((element) => element.offsetTop + element.offsetHeight / 2)
		const to = ribbonInsertionIndex(pointerY, midpoints)
		if (to === position.to) return
		const next = { from: position.from, to }
		dragPositionRef.current = next
		setDragPosition(next)
	}

	const startLongPress = (event: PointerEvent<HTMLAnchorElement>, kind: RibbonTagKind) => {
		if (!canEdit || event.button !== 0) return
		event.preventDefault()
		clearPress()
		const target = event.currentTarget
		const pointerId = event.pointerId
		const x = event.clientX
		const y = event.clientY
		suppressClickRef.current = false
		target.setPointerCapture(pointerId)
		pressPointRef.current = { x, y }
		pressStartedAtRef.current = performance.now()
		if (editing) {
			dragCandidateRef.current = { pointerId, kind, x, y }
			return
		}
		pressTimerRef.current = window.setTimeout(() => {
			pressTimerRef.current = null
			dragCandidateRef.current = { pointerId, kind, x, y }
			suppressClickRef.current = true
			setEditing(true)
		}, LONG_PRESS_MS)
	}

	const movePointer = (event: PointerEvent<HTMLElement>) => {
		const candidate = dragCandidateRef.current
		if (candidate?.pointerId === event.pointerId) {
			if (draggedRef.current !== candidate.kind) {
				const distance = Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y)
				if (distance < DRAG_THRESHOLD) return
				const from = items.findIndex((item) => item.kind === candidate.kind)
				if (from < 0) return
				draggedRef.current = candidate.kind
				dragPositionRef.current = { from, to: from }
				setSettling(null)
				setDragged(candidate.kind)
				setDragPosition({ from, to: from })
				suppressClickRef.current = true
				onDraggingChange(true)
			}
			event.preventDefault()
			setDragPoint({ x: event.clientX, y: event.clientY })
			previewDrag(event.clientY)
			return
		}
		const point = pressPointRef.current
		if (
			(event.buttons & 1) === 1 &&
			Math.hypot(event.clientX - point.x, event.clientY - point.y) > 8
		) {
			clearPress()
			suppressClickRef.current = true
		}
	}

	const finishPointer = (
		event: PointerEvent<HTMLAnchorElement>,
		persist: boolean,
		href?: string,
	) => {
		const shouldNavigate =
			persist &&
			canEdit &&
			!editing &&
			!suppressClickRef.current &&
			!draggedRef.current &&
			event.button === 0 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey &&
			performance.now() - pressStartedAtRef.current < LONG_PRESS_MS
		clearPress()
		if (dragCandidateRef.current?.pointerId === event.pointerId) dragCandidateRef.current = null
		if (draggedRef.current) {
			const position = dragPositionRef.current
			setSettling(persist && expandedRef.current ? draggedRef.current : null)
			draggedRef.current = null
			dragPositionRef.current = null
			setDragged(null)
			setDragPosition(null)
			setDragPoint(null)
			onDraggingChange(false)
			if (persist && expandedRef.current && position && position.from !== position.to) {
				skipNextFlipRef.current = true
				if (!onMove(position.from, position.to)) skipNextFlipRef.current = false
			}
		}
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId)
		}
		if (shouldNavigate && href) {
			suppressClickRef.current = true
			navigate(href)
		}
	}

	const remove = (kind: RibbonTagKind) => {
		if (removing || items.length <= 1) return
		clearPress()
		if (prefersReducedMotion()) {
			onRemove(kind)
			return
		}
		setRemoving(kind)
		removeTimerRef.current = window.setTimeout(() => {
			removeTimerRef.current = null
			onRemove(kind)
			setRemoving(null)
		}, REMOVE_MS)
	}

	const moveWithKeyboard = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
		if (!editing || !event.altKey) return
		const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : index
		if (to === index) return
		event.preventDefault()
		onMove(index, to)
	}

	const visibleKinds = new Set(items.map((item) => item.kind))
	const availableItems = candidates.filter((item) => !visibleKinds.has(item.kind))
	const draggedItem = dragged ? items.find((item) => item.kind === dragged) : undefined

	return (
		<>
			<ul
				ref={listRef}
				className={cn('rv-ribbon-list relative flex flex-col items-center gap-[2px] pt-[14px]', {
					'is-settling': settling !== null,
				})}
				onPointerMoveCapture={movePointer}
				onClickCapture={(event) => {
					if (!(event.target instanceof Element) || !event.target.closest('a')) return
					const allowNativeClick =
						!canEdit ||
						(!editing &&
							!suppressClickRef.current &&
							(event.detail === 0 ||
								event.metaKey ||
								event.ctrlKey ||
								event.shiftKey ||
								event.altKey))
					if (allowNativeClick) return
					event.preventDefault()
					event.stopPropagation()
					suppressClickRef.current = false
				}}
			>
				{items.map((item, index) => {
					const isActive = active === item.href
					const dragOffset = dragPosition
						? ribbonDragOffset(index, dragPosition.from, dragPosition.to)
						: 0
					return (
						<li
							key={item.kind}
							data-flip-key={item.kind}
							className={cn(
								'rv-ribbon-item relative',
								editing && 'is-editing',
								removing === item.kind && 'is-removing',
								dragged === item.kind && 'is-dragging',
								settling === item.kind && 'is-settling',
							)}
							style={{
								['--rv-ribbon-i' as string]: index,
								['--rv-wiggle-delay' as string]: `${index * -45}ms`,
								transform:
									dragOffset === 0
										? undefined
										: `translateY(calc(${dragOffset * 100}% + ${dragOffset * 2}px))`,
								transitionDelay: dragPosition ? '0ms' : undefined,
							}}
						>
							<HoverCard
								openDelay={120}
								closeDelay={0}
								open={!editing && hovered === item.kind}
								onOpenChange={(open) =>
									setHovered((current) =>
										open ? item.kind : current === item.kind ? null : current,
									)
								}
							>
								<HoverCardTrigger asChild>
									<a
										href={editing ? undefined : item.href}
										aria-disabled={editing || undefined}
										aria-current={isActive ? 'page' : undefined}
										aria-label={editing ? `${item.label}，Alt 加方向键调整顺序` : undefined}
										data-kind={item.kind}
										draggable={false}
										tabIndex={editing ? 0 : undefined}
										className={cn(
											'rv-ribbon-tag relative flex h-[84px] w-[70px] select-none flex-col items-center outline-none [touch-action:none]',
											isActive && 'is-active',
										)}
										onPointerDown={(event) => startLongPress(event, item.kind)}
										onPointerUp={(event) => finishPointer(event, true, item.href)}
										onPointerCancel={(event) => finishPointer(event, false)}
										onLostPointerCapture={(event) => finishPointer(event, false)}
										onKeyDown={(event) => moveWithKeyboard(event, index)}
									>
										{dragged === item.kind ? (
											<Badge variant="outline" className="my-auto px-[7px] text-[12px]">
												insert here
											</Badge>
										) : (
											<RibbonTagPreview
												kind={item.kind}
												active={isActive}
												caption={item.caption}
												label={item.label}
												interactive
											/>
										)}
									</a>
								</HoverCardTrigger>
								<HoverCardContent
									side="right"
									sideOffset={2}
									className="w-auto whitespace-nowrap px-3 py-2 text-xs"
								>
									{item.label} · {item.caption}
								</HoverCardContent>
							</HoverCard>
							{editing && items.length > 1 && dragged !== item.kind && (
								<button
									type="button"
									aria-label={`移除${item.label}标签`}
									className="rv-ribbon-remove absolute -right-[5px] -top-[2px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-[var(--sidebar-tag-stroke)] text-[var(--sidebar-tag-fill)] shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
									onClick={() => remove(item.kind)}
								>
									<X size={14} strokeWidth={3} />
								</button>
							)}
						</li>
					)
				})}
			</ul>
			{canEdit && (
				<div className="relative mt-[5px] flex items-center justify-center gap-2">
					{!editing && canLock && (
						<button
							type="button"
							aria-label={locked ? '取消固定左侧导航' : '固定左侧导航'}
							aria-pressed={locked}
							className="rv-ribbon-remove flex h-6 w-6 items-center justify-center rounded-full border border-white bg-[var(--sidebar-tag-fill)] text-[var(--sidebar-tag-stroke)] shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
							onClick={onToggleLock}
						>
							{locked ? <Lock size={14} strokeWidth={3} /> : <LockOpen size={14} strokeWidth={3} />}
						</button>
					)}
					{editing && (
						<Popover open={addOpen} onOpenChange={setAddOpen}>
							<PopoverTrigger asChild>
								<button
									type="button"
									aria-label="添加左侧标签"
									className="rv-ribbon-remove flex h-6 w-6 items-center justify-center rounded-full border border-white bg-[var(--sidebar-tag-fill)] text-[var(--sidebar-tag-stroke)] shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
								>
									<Plus size={14} strokeWidth={3} />
								</button>
							</PopoverTrigger>
							<PopoverContent
								ref={addContentRef}
								side="right"
								align="end"
								className="w-64 p-[10px]"
							>
								<p className="px-2 pb-2 pt-1 text-xs text-muted-foreground">添加一个未展示的标签</p>
								{availableItems.length === 0 ? (
									<p className="px-2 pb-2 text-sm">所有标签均已添加</p>
								) : (
									<ul className="grid grid-cols-3 gap-1">
										{availableItems.map((item) => (
											<li key={item.kind}>
												<button
													type="button"
													className="flex w-full flex-col items-center rounded-md px-1 py-[7px] text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
													onClick={() => {
														if (onAdd(item.kind)) setAddOpen(false)
													}}
												>
													<RibbonTagPreview
														kind={item.kind}
														caption={item.caption}
														label={item.label}
													/>
													<span>{item.label}</span>
												</button>
											</li>
										))}
									</ul>
								)}
							</PopoverContent>
						</Popover>
					)}
				</div>
			)}
			{draggedItem &&
				dragPoint &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						aria-hidden
						data-kind={draggedItem.kind}
						className={cn(
							'rv-ribbon-tag pointer-events-none fixed z-[100] flex h-[84px] w-[70px] select-none flex-col items-center',
							active === draggedItem.href && 'is-active',
						)}
						style={{
							left: dragPoint.x,
							top: dragPoint.y,
							transform: 'translate(-50%, -50%)',
						}}
					>
						<RibbonTagPreview
							kind={draggedItem.kind}
							active={active === draggedItem.href}
							caption={draggedItem.caption}
							label={draggedItem.label}
							interactive
						/>
					</div>,
					document.body,
				)}
		</>
	)
}
