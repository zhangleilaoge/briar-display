'use client'

/**
 * 全站动效基础件（纸艺 / 1999 风）：只动 transform / opacity（AutoHeight 例外，仅容器高度），
 * 时长与缓动统一取自 theme.css 的 --motion-* token；全部尊重 prefers-reduced-motion。
 */
import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react'

export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export const MOTION = {
	fast: 180,
	base: 260,
	slow: 400,
	/** 弹窗「电视关机」总时长，需与 theme.css 中 rv-crt-off 一致 */
	crt: 380,
	ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const

export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches
	)
}

/**
 * FLIP 列表动画：子元素按 data-flip-key 标识；列表变化后已有项从旧位置平滑滑到新位置，
 * 新出现的项打上 data-flip-enter（由 CSS 播放入场，如吊牌垂落）。首帧不播放。
 */
export function useFlip(containerRef: RefObject<HTMLElement | null>, deps: unknown[]) {
	const rects = useRef<Map<string, DOMRect> | null>(null)
	useIsoLayoutEffect(() => {
		const el = containerRef.current
		if (!el) return
		const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-flip-key]'))
		const prev = rects.current
		const next = new Map<string, DOMRect>()
		for (const n of nodes) next.set(n.dataset.flipKey as string, n.getBoundingClientRect())
		rects.current = next
		if (!prev || prefersReducedMotion()) return
		for (const n of nodes) {
			const key = n.dataset.flipKey as string
			const old = prev.get(key)
			const now = next.get(key)
			if (!old) {
				n.setAttribute('data-flip-enter', '')
				n.addEventListener('animationend', () => n.removeAttribute('data-flip-enter'), {
					once: true,
				})
				continue
			}
			if (!now) continue
			const dx = old.left - now.left
			const dy = old.top - now.top
			if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
			n.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], {
				duration: MOTION.slow,
				easing: MOTION.ease,
			})
		}
	}, deps)
}

/**
 * 高度自适应容器：内容高度变化时外层高度平滑过渡（ResizeObserver）。
 * 动画期间才 overflow:clip，结束后恢复 height:auto，不影响内部浮层与角标。
 */
export function AutoHeight({
	children,
	className,
	style,
}: {
	children: ReactNode
	className?: string
	style?: CSSProperties
}) {
	const outer = useRef<HTMLDivElement>(null)
	const inner = useRef<HTMLDivElement>(null)
	const last = useRef<number | null>(null)

	useEffect(() => {
		const o = outer.current
		const i = inner.current
		if (!o || !i || typeof ResizeObserver === 'undefined') return
		let anim: Animation | null = null
		const ro = new ResizeObserver(() => {
			const h = i.offsetHeight
			const from = last.current
			last.current = h
			if (from === null || Math.abs(from - h) < 2 || prefersReducedMotion()) return
			anim?.cancel()
			o.style.overflow = 'clip'
			anim = o.animate([{ height: `${from}px` }, { height: `${h}px` }], {
				duration: MOTION.base,
				easing: MOTION.ease,
			})
			anim.onfinish = anim.oncancel = () => {
				o.style.overflow = ''
			}
		})
		ro.observe(i)
		return () => {
			ro.disconnect()
			anim?.cancel()
		}
	}, [])

	return (
		<div ref={outer} className={className} style={style}>
			<div ref={inner} className="flow-root">
				{children}
			</div>
		</div>
	)
}

/**
 * 手写弹窗的退场：requestClose 先把 data-state 置为 closed 播放「电视关机」，结束后再真正卸载。
 */
export function useExitAnimation(onClose: () => void, duration: number = MOTION.crt) {
	const [closing, setClosing] = useState(false)
	const timer = useRef<number | null>(null)
	const requestClose = useCallback(() => {
		if (timer.current !== null) return
		if (prefersReducedMotion()) {
			onClose()
			return
		}
		setClosing(true)
		timer.current = window.setTimeout(() => {
			timer.current = null
			setClosing(false)
			onClose()
		}, duration)
	}, [onClose, duration])
	useEffect(
		() => () => {
			if (timer.current !== null) window.clearTimeout(timer.current)
		},
		[],
	)
	return { closing, requestClose, state: closing ? ('closed' as const) : ('open' as const) }
}
