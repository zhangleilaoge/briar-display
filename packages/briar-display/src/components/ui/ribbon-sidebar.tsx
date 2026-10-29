'use client'

/**
 * 全局左侧导航：手绘异形吊牌壳 + 插画切图贴纸 + font-label 法文 caption；图文一组居中（拱形 / 花边圆 / 波浪底 / 心形 / 椭圆 Cameo 等）。
 * 颜色走 --sidebar-*；md+ 无底不占位，热区拉出；窄屏底部横滑。
 */
import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card'
import { useFlip } from './motion'
import {
	RIBBON_JITTER,
	RIBBON_STICKER_SRC,
	RIBBON_TAG_BY_KIND,
	type RibbonTagKind,
	TagAdmin,
	TagFiles,
	TagHome,
	TagMarkets,
	TagProfile,
	TagStyle,
	TagThoughts,
	TagTools,
} from './ribbon-tags'

interface RibbonItem {
	href: string
	match: string
	label: string
	caption: string
	kind: RibbonTagKind
	adminOnly?: boolean
}

export const RIBBON_ITEMS: RibbonItem[] = [
	{ href: '/briar/', match: '/briar', label: '首页', caption: 'Accueil', kind: 'home' },
	{
		href: '/briar/style',
		match: '/briar/style',
		label: '风格',
		caption: 'Style',
		kind: 'style',
	},
	{
		href: '/briar/tools',
		match: '/briar/tools',
		label: '工具箱',
		caption: 'Outils',
		kind: 'tools',
	},
	{
		href: '/briar/files',
		match: '/briar/files',
		label: '文件',
		caption: 'Fichiers',
		kind: 'files',
	},
	{
		href: '/briar/thoughts/',
		match: '/briar/thoughts',
		label: '想法',
		caption: 'Pensées',
		kind: 'thoughts',
	},
	{
		href: '/briar/markets',
		match: '/briar/markets',
		label: '行情',
		caption: 'Étoiles',
		kind: 'markets',
	},
	{
		href: '/briar/admin',
		match: '/briar/admin',
		label: '管理',
		caption: 'Clef',
		kind: 'admin',
		adminOnly: true,
	},
	{
		href: '/briar/profile',
		match: '/briar/profile',
		label: '个人',
		caption: 'Moi',
		kind: 'profile',
	},
]

/** 找出最长前缀匹配的项；首页仅精确匹配 */
export function activeRibbonHref(pathname: string): string | null {
	const path = pathname.replace(/\/+$/, '') || '/'
	let best: RibbonItem | null = null
	for (const item of RIBBON_ITEMS) {
		const hit =
			item.match === '/briar'
				? path === '/briar'
				: path === item.match || path.startsWith(`${item.match}/`)
		if (hit && (!best || item.match.length > best.match.length)) best = item
	}
	return best?.href ?? null
}

const NUDGE_KEY = 'rv-ribbon-nudge-v1'

export interface RibbonSidebarProps {
	className?: string
	currentPath?: string
}

/** 离开热区后延迟再收起（进区立刻展开；重进取消计时） */
const RIBBON_LEAVE_MS = 2500

/** 跨组件实例记录最近指针坐标，供挂载时 elementFromPoint 使用 */
const lastPointer = { x: Number.NaN, y: Number.NaN }
if (typeof document !== 'undefined') {
	document.addEventListener(
		'pointermove',
		(e: PointerEvent) => {
			lastPointer.x = e.clientX
			lastPointer.y = e.clientY
		},
		{ passive: true },
	)
}

function pointerHitsRibbon(nav: HTMLElement, x: number, y: number): boolean {
	if (!Number.isFinite(x) || !Number.isFinite(y)) return false
	const hit = document.elementFromPoint(x, y)
	return Boolean(hit && (hit === nav || nav.contains(hit)))
}

export function RibbonSidebar({ className, currentPath }: RibbonSidebarProps) {
	const { isAdmin } = usePermissions()
	const [path, setPath] = useState(currentPath ?? '')
	const [mounted, setMounted] = useState(false)
	const [open, setOpen] = useState(false)
	const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const navRef = useRef<HTMLElement>(null)

	const clearLeaveTimer = useCallback(() => {
		if (leaveTimerRef.current != null) {
			clearTimeout(leaveTimerRef.current)
			leaveTimerRef.current = null
		}
	}, [])

	const openNow = useCallback(() => {
		clearLeaveTimer()
		setOpen(true)
	}, [clearLeaveTimer])

	const scheduleClose = useCallback(() => {
		clearLeaveTimer()
		leaveTimerRef.current = setTimeout(() => {
			leaveTimerRef.current = null
			setOpen(false)
		}, RIBBON_LEAVE_MS)
	}, [clearLeaveTimer])

	useEffect(() => {
		setPath(window.location.pathname)
		setMounted(true)
	}, [])

	useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer])

	/** 挂载时指针已停在热区：仅 mouseenter 不够，用 :hover / elementFromPoint / 首个 pointer 补展开 */
	useEffect(() => {
		const nav = navRef.current
		if (!nav) return

		const tryOpenFromPointer = () => {
			if (typeof nav.matches === 'function' && nav.matches(':hover')) {
				openNow()
				return true
			}
			if (pointerHitsRibbon(nav, lastPointer.x, lastPointer.y)) {
				openNow()
				return true
			}
			return false
		}

		if (tryOpenFromPointer()) return

		const raf = requestAnimationFrame(() => {
			tryOpenFromPointer()
		})

		const onPointer = (e: PointerEvent) => {
			lastPointer.x = e.clientX
			lastPointer.y = e.clientY
			if (pointerHitsRibbon(nav, e.clientX, e.clientY)) {
				openNow()
				document.removeEventListener('pointermove', onPointer)
			}
		}
		document.addEventListener('pointermove', onPointer, { passive: true })

		return () => {
			cancelAnimationFrame(raf)
			document.removeEventListener('pointermove', onPointer)
		}
	}, [openNow])

	const active = activeRibbonHref(path)
	const items = RIBBON_ITEMS.filter((item) => !item.adminOnly || (mounted && isAdmin))
	const listRef = useRef<HTMLUListElement>(null)
	useFlip(listRef, [items.length])

	return (
		<>
			<nav
				ref={navRef}
				aria-label="全局导航"
				data-open={open ? '' : undefined}
				onMouseEnter={openNow}
				onMouseLeave={scheduleClose}
				onFocusCapture={openNow}
				onBlurCapture={(event) => {
					const next = event.relatedTarget
					if (next instanceof Node && event.currentTarget.contains(next)) return
					scheduleClose()
				}}
				className={cn(
					'rv-ribbon group/ribbon fixed inset-y-0 left-0 z-[60] hidden w-[5.25rem] md:block',
					className,
				)}
			>
				<div className="rv-ribbon-rail absolute inset-y-0 left-0 flex w-[4.75rem] flex-col items-center pt-2">
					<span
						aria-hidden
						className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--sidebar-string)]"
					/>
					<span
						aria-hidden
						className="relative mb-1 h-2.5 w-2.5 rotate-45 border border-[color:var(--sidebar-tag-stroke)] bg-[var(--sidebar-tag-fill)]"
					/>
					<ul ref={listRef} className="relative flex flex-col items-center gap-0.5">
						{items.map((item, i) => {
							const Tag = RIBBON_TAG_BY_KIND[item.kind]
							const isActive = active === item.href
							const jitter = RIBBON_JITTER[i % RIBBON_JITTER.length]
							return (
								<li
									key={item.href}
									data-flip-key={item.href}
									className="rv-ribbon-item"
									style={{ ['--rv-ribbon-i' as string]: i }}
								>
									<HoverCard openDelay={120} closeDelay={0}>
										<HoverCardTrigger asChild>
											<a
												href={item.href}
												aria-current={isActive ? 'page' : undefined}
												data-kind={item.kind}
												className={cn(
													'rv-ribbon-tag relative flex h-[70px] w-[58px] flex-col items-center outline-none',
													isActive && 'is-active',
												)}
												style={{
													transform: `translateX(${jitter.x}px) rotate(${jitter.rotate}deg)`,
												}}
											>
												<Tag active={isActive} />
												<span className="rv-ribbon-stack" aria-hidden>
													<img
														src={RIBBON_STICKER_SRC[item.kind]}
														alt=""
														draggable={false}
														decoding="async"
														className="rv-ribbon-cutout select-none object-contain"
													/>
													<span className="rv-ribbon-caption rv-tag-label font-label text-[7.5px] uppercase tracking-[0.05em]">
														{item.caption}
													</span>
												</span>
												<span className="sr-only">
													{item.label} · {item.caption}
												</span>
											</a>
										</HoverCardTrigger>
										<HoverCardContent
											side="right"
											sideOffset={10}
											className="w-auto whitespace-nowrap px-3 py-2 text-xs"
										>
											{item.label} · {item.caption}
										</HoverCardContent>
									</HoverCard>
								</li>
							)
						})}
					</ul>
				</div>
			</nav>
			<MobileRibbonNav items={items} active={active} />
		</>
	)
}

interface MobileRibbonNavProps {
	items: RibbonItem[]
	active: string | null
}

function MobileRibbonNav({ items, active }: MobileRibbonNavProps) {
	const trackRef = useRef<HTMLUListElement>(null)
	const [edge, setEdge] = useState({ left: false, right: false })
	const nudgedRef = useRef(false)
	useFlip(trackRef, [items.length])

	const updateEdge = useCallback(() => {
		const el = trackRef.current
		if (!el) return
		const max = el.scrollWidth - el.clientWidth
		setEdge({ left: el.scrollLeft > 4, right: max - el.scrollLeft > 4 })
	}, [])

	useEffect(() => {
		const el = trackRef.current
		if (!el) return
		updateEdge()
		el.addEventListener('scroll', updateEdge, { passive: true })
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdge) : null
		ro?.observe(el)
		return () => {
			el.removeEventListener('scroll', updateEdge)
			ro?.disconnect()
		}
	}, [updateEdge, items.length])

	useEffect(() => {
		if (nudgedRef.current) return
		try {
			if (sessionStorage.getItem(NUDGE_KEY)) return
		} catch {
			/* ignore */
		}
		nudgedRef.current = true
		const reduce =
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (reduce) return

		let cancelled = false
		const timer = window.setTimeout(() => {
			if (cancelled || !trackRef.current) return
			const track = trackRef.current
			const max = track.scrollWidth - track.clientWidth
			if (max <= 8) return
			const start = track.scrollLeft
			track.scrollTo({ left: start + 12, behavior: 'smooth' })
			window.setTimeout(() => {
				if (cancelled || !trackRef.current) return
				trackRef.current.scrollTo({ left: start, behavior: 'smooth' })
				try {
					sessionStorage.setItem(NUDGE_KEY, '1')
				} catch {
					/* ignore */
				}
			}, 420)
		}, 700)
		return () => {
			cancelled = true
			window.clearTimeout(timer)
		}
	}, [items.length])

	return (
		<nav
			aria-label="全局导航"
			className="rv-ribbon-mobile fixed inset-x-0 bottom-0 z-[60] border-t border-[color:var(--rv-line)] bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_18px_-12px_hsl(var(--foreground)/0.35)] [background-image:var(--sidebar-bg)] backdrop-blur-md md:hidden"
		>
			<span aria-hidden className="absolute inset-x-0 top-2 h-px bg-[var(--sidebar-string)]" />
			<div className="relative">
				<ul
					ref={trackRef}
					className="rv-ribbon-mobile-track relative flex h-[4.5rem] items-start gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 scroll-smooth"
				>
					{items.map((item, i) => {
						const Tag = RIBBON_TAG_BY_KIND[item.kind]
						const isActive = active === item.href
						const jitter = RIBBON_JITTER[i % RIBBON_JITTER.length]
						return (
							<li
								key={item.href}
								data-flip-key={item.href}
								className="rv-ribbon-mobile-item shrink-0 snap-start"
							>
								<a
									href={item.href}
									aria-current={isActive ? 'page' : undefined}
									data-kind={item.kind}
									className={cn(
										'rv-ribbon-tag group flex h-[4.25rem] w-[3.4rem] min-w-11 flex-col items-center outline-none',
										isActive && 'is-active',
									)}
									style={{
										transform: `rotate(${jitter.rotate / 2}deg)`,
									}}
								>
									<span aria-hidden className="h-1.5 w-px bg-[var(--sidebar-string)]" />
									<span className="relative h-[58px] w-[48px]">
										<Tag active={isActive} />
										<span className="rv-ribbon-stack" aria-hidden>
											<img
												src={RIBBON_STICKER_SRC[item.kind]}
												alt=""
												draggable={false}
												decoding="async"
												className="rv-ribbon-cutout select-none object-contain"
											/>
											<span className="rv-ribbon-caption rv-tag-label font-label text-[6.5px] uppercase tracking-[0.04em]">
												{item.caption}
											</span>
										</span>
									</span>
									<span className="sr-only">{item.label}</span>
								</a>
							</li>
						)
					})}
					<li aria-hidden className="w-6 shrink-0" />
				</ul>
				<span aria-hidden className={cn('rv-ribbon-fade rv-ribbon-fade-l', edge.left && 'is-on')} />
				<span
					aria-hidden
					className={cn('rv-ribbon-fade rv-ribbon-fade-r', edge.right && 'is-on')}
				/>
			</div>
		</nav>
	)
}

export default RibbonSidebar

// re-export tag components in case ornaments/tests referenced old icons via sidebar
export { TagAdmin, TagFiles, TagHome, TagMarkets, TagProfile, TagStyle, TagThoughts, TagTools }
