'use client'

/**
 * 活页掀页：顶页沿左缘（打孔侧）柔性卷边掀开，露出下一张。
 * 卷边高光 + 弯曲投射阴影，避免刚性 fade。
 * 尊重 prefers-reduced-motion：直接切内容、不播动画。
 */
import { prefersReducedMotion } from '@/components/ui/motion'
import { cn } from '@/lib/utils'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

const PEEL_MS = 780

type Props = {
	/** 内容身份：变化时触发掀页（换一句 / 初次就绪） */
	contentKey: string | number
	/** 是否已就绪；首次 ready 时播入场掀页 */
	ready?: boolean
	className?: string
	style?: CSSProperties
	children: ReactNode
}

export function BinderPeel({ contentKey, ready = true, className, style, children }: Props) {
	const [overlay, setOverlay] = useState<ReactNode | null>(null)
	const [peeling, setPeeling] = useState(false)
	const prevKey = useRef<string | number | null>(null)
	const prevChild = useRef<ReactNode>(null)
	const entered = useRef(false)
	const reduceRef = useRef(false)

	useEffect(() => {
		reduceRef.current = prefersReducedMotion()
	}, [])

	const finish = useCallback(() => {
		setPeeling(false)
		setOverlay(null)
	}, [])

	useEffect(() => {
		if (!ready) return

		const reduce = reduceRef.current || prefersReducedMotion()

		// 初次进入：空白顶页掀开露出问候
		if (!entered.current) {
			entered.current = true
			prevKey.current = contentKey
			prevChild.current = children
			if (reduce) return
			setOverlay(
				<div className="rv-binder-peel__blank" aria-hidden>
					<span className="rv-script text-2xl text-[color:var(--rv-rose-deep)]/40">…</span>
				</div>,
			)
			requestAnimationFrame(() => {
				requestAnimationFrame(() => setPeeling(true))
			})
			const t = window.setTimeout(finish, PEEL_MS + 60)
			return () => window.clearTimeout(t)
		}

		if (prevKey.current === contentKey) {
			prevChild.current = children
			return
		}

		const outgoing = prevChild.current
		prevKey.current = contentKey
		prevChild.current = children

		if (reduce || !outgoing) return

		setOverlay(outgoing)
		setPeeling(false)
		requestAnimationFrame(() => {
			requestAnimationFrame(() => setPeeling(true))
		})
		const t = window.setTimeout(finish, PEEL_MS + 60)
		return () => window.clearTimeout(t)
	}, [contentKey, ready, children, finish])

	return (
		<div className={cn('rv-binder-peel', peeling && 'is-peeling', className)} style={style}>
			<div className="rv-binder-peel__base">{children}</div>
			{overlay && (
				<div className={cn('rv-binder-peel__sheet', peeling && 'is-peeled')} aria-hidden>
					<div className="rv-binder-peel__face">{overlay}</div>
					<span className="rv-binder-peel__curl" aria-hidden />
					<span className="rv-binder-peel__shade" aria-hidden />
				</div>
			)}
		</div>
	)
}
