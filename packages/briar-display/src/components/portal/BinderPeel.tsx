'use client'

import { prefersReducedMotion, useIsoLayoutEffect } from '@/components/ui/motion'
import { cn } from '@/lib/utils'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

const PEEL_MS = 680
const PEEL_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'

type Props = {
	contentKey: string | number
	ready?: boolean
	className?: string
	style?: CSSProperties
	children: ReactNode
}

type Turn = {
	content: ReactNode
	fromHeight: number
	toHeight: number
}

/** 单张活页纸绕左缘翻转；旧纸文字随正面运动，新纸在下方被揭开。 */
export function BinderPeel({ contentKey, ready = true, className, style, children }: Props) {
	const [turn, setTurn] = useState<Turn | null>(null)
	const rootRef = useRef<HTMLDivElement>(null)
	const baseRef = useRef<HTMLDivElement>(null)
	const sheetRef = useRef<HTMLDivElement>(null)
	const prevKey = useRef<string | number | null>(null)
	const prevChild = useRef<ReactNode>(null)
	const lastHeight = useRef<number | null>(null)
	const turning = useRef(false)
	const animations = useRef<Animation[]>([])

	const cancelAnimations = useCallback(() => {
		for (const animation of animations.current) {
			animation.onfinish = null
			animation.cancel()
		}
		animations.current = []
	}, [])

	useEffect(() => {
		const base = baseRef.current
		if (!base || typeof ResizeObserver === 'undefined') return
		const observer = new ResizeObserver(() => {
			if (!turning.current) lastHeight.current = base.offsetHeight
		})
		observer.observe(base)
		return () => observer.disconnect()
	}, [])

	useIsoLayoutEffect(() => {
		const root = rootRef.current
		const base = baseRef.current
		if (!root || !base || !ready) return

		const nextHeight = base.offsetHeight
		if (prevKey.current === null) {
			prevKey.current = contentKey
			prevChild.current = children
			lastHeight.current = nextHeight
			return
		}

		if (prevKey.current === contentKey) {
			prevChild.current = children
			if (!turning.current) lastHeight.current = nextHeight
			return
		}

		const fromHeight = turning.current
			? root.getBoundingClientRect().height
			: (lastHeight.current ?? root.getBoundingClientRect().height)
		const outgoing = prevChild.current
		prevKey.current = contentKey
		prevChild.current = children
		cancelAnimations()
		turning.current = false
		lastHeight.current = nextHeight

		if (!outgoing || prefersReducedMotion()) {
			setTurn(null)
			return
		}

		turning.current = true
		setTurn({ content: outgoing, fromHeight, toHeight: nextHeight })
	}, [cancelAnimations, children, contentKey, ready])

	useIsoLayoutEffect(() => {
		const root = rootRef.current
		const sheet = sheetRef.current
		if (!turn || !root || !sheet) return

		const sheetAnimation = sheet.animate(
			[{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-90deg)' }],
			{ duration: PEEL_MS, easing: PEEL_EASE, fill: 'forwards' },
		)
		const nextAnimations = [sheetAnimation]
		if (Math.abs(turn.toHeight - turn.fromHeight) >= 1) {
			nextAnimations.push(
				root.animate([{ height: `${turn.fromHeight}px` }, { height: `${turn.toHeight}px` }], {
					duration: PEEL_MS,
					easing: PEEL_EASE,
					fill: 'forwards',
				}),
			)
		}
		animations.current = nextAnimations
		sheetAnimation.onfinish = () => {
			if (animations.current[0] !== sheetAnimation) return
			turning.current = false
			lastHeight.current = baseRef.current?.offsetHeight ?? turn.toHeight
			setTurn(null)
		}

		return cancelAnimations
	}, [cancelAnimations, turn])

	return (
		<div
			ref={rootRef}
			className={cn('rv-binder-peel', className)}
			style={{ ...style, ...(turn ? { height: `${turn.fromHeight}px` } : null) }}
			data-turning={turn ? '' : undefined}
		>
			<div ref={baseRef} className="rv-binder-peel__base">
				{children}
			</div>
			{turn && (
				<div
					className="rv-binder-peel__stage"
					style={{ height: `${turn.fromHeight}px` }}
					aria-hidden
					inert
				>
					<div ref={sheetRef} className="rv-binder-peel__sheet">
						{turn.content}
					</div>
				</div>
			)}
		</div>
	)
}
