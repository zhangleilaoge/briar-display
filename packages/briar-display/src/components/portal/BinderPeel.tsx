'use client'

/**
 * 活页掀页：右下角 soft corner curl（参考 StPageFlip / Bilibili Paper，不迁入整库）。
 * - 折线锚在右下角，最大揭起约短边 35–45%，非整页从腰切开
 * - face 与 flap 同带 outgoing 文案：字跟着被掀的纸走
 * - 容器 overflow:hidden，瓣尖不得窜出纸顶
 * prefers-reduced-motion：直接切内容
 */
import { prefersReducedMotion } from '@/components/ui/motion'
import { cn } from '@/lib/utils'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

const PEEL_MS = 1100

type Props = {
	contentKey: string | number
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
			const t = window.setTimeout(finish, PEEL_MS + 80)
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
		const t = window.setTimeout(finish, PEEL_MS + 80)
		return () => window.clearTimeout(t)
	}, [contentKey, ready, children, finish])

	return (
		<div className={cn('rv-binder-peel', peeling && 'is-peeling', className)} style={style}>
			<div className="rv-binder-peel__base">{children}</div>
			{overlay && (
				<div className={cn('rv-binder-peel__sheet', peeling && 'is-peeled')} aria-hidden>
					{/* 残留纸面：右下角缺口随进度扩大；旧文随 clip 留在未掀区域 */}
					<div className="rv-binder-peel__face">{overlay}</div>
					{/* 掀起的纸角：同份旧文 + 纸背明暗，绕右下角 soft curl */}
					<span className="rv-binder-peel__flap">
						<span className="rv-binder-peel__flap-face">{overlay}</span>
						<span className="rv-binder-peel__flap-back" />
					</span>
					{/* 折线落在底页上的接触影 */}
					<span className="rv-binder-peel__cast" aria-hidden />
				</div>
			)}
		</div>
	)
}
