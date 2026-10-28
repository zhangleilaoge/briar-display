'use client'

import '@openpageflip/core/styles.css'
import { prefersReducedMotion, useIsoLayoutEffect } from '@/components/ui/motion'
import { cn } from '@/lib/utils'
import { type Book, FlipBook, Page } from '@openpageflip/react'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

const PEEL_MS = 920

type Props = {
	contentKey: string | number
	ready?: boolean
	className?: string
	style?: CSSProperties
	children: ReactNode
}

type Paper = {
	id: number
	key: string | number
	content: ReactNode
	height?: number
}

type Turn = {
	key: string | number
	fromHeight: number
	toHeight: number
	targetPage: number
}

function easeInOutCubic(t: number) {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** 软纸从右下角卷起；可见页保留快照，隐藏测量层只负责同步容器高度。 */
export function BinderPeel({ contentKey, ready = true, className, style, children }: Props) {
	const [pages, setPages] = useState<Paper[]>([{ id: 0, key: contentKey, content: children }])
	const [bookSize, setBookSize] = useState({ width: 0, height: 0 })
	const rootRef = useRef<HTMLDivElement>(null)
	const measureRef = useRef<HTMLDivElement>(null)
	const bookRef = useRef<Book>(null)
	const restHeight = useRef(0)
	const pagesRef = useRef(pages)
	const requestedKey = useRef<string | number | null>(null)
	const shown = useRef<Paper>(pages[0])
	const pending = useRef<{ key: string | number; content: ReactNode } | null>(null)
	const turn = useRef<Turn | null>(null)
	const resetting = useRef(false)
	const nextId = useRef(1)
	const styleRef = useRef(style)
	styleRef.current = style

	useIsoLayoutEffect(() => {
		const measure = measureRef.current
		if (!measure) return
		restHeight.current = measure.offsetHeight
		setBookSize({ width: measure.offsetWidth, height: measure.offsetHeight })
	}, [])

	useEffect(() => {
		const measure = measureRef.current
		if (!measure || typeof ResizeObserver === 'undefined') return
		const observer = new ResizeObserver(() => {
			if (turn.current) return
			restHeight.current = measure.offsetHeight
			setBookSize({ width: measure.offsetWidth, height: measure.offsetHeight })
		})
		observer.observe(measure)
		return () => observer.disconnect()
	}, [])

	const renderPages = useCallback((next: Paper[]) => {
		pagesRef.current = next
		setPages(next)
	}, [])

	const showInstant = useCallback(
		(content: ReactNode, key: string | number, height?: number) => {
			resetting.current = true
			turn.current = null
			pending.current = null
			const paper = { id: nextId.current++, key, content, height }
			shown.current = paper
			renderPages([paper])
		},
		[renderPages],
	)

	const beginTurn = useCallback(
		(content: ReactNode, key: string | number) => {
			const root = rootRef.current
			const measure = measureRef.current
			if (!root || !measure) return
			const toHeight = measure.offsetHeight
			if (!shown.current.content || prefersReducedMotion()) {
				showInstant(content, key, toHeight)
				return
			}

			const fromHeight = restHeight.current || root.getBoundingClientRect().height
			turn.current = { key, fromHeight, toHeight, targetPage: pagesRef.current.length }
			root.style.height = `${fromHeight}px`
			setBookSize({ width: measure.offsetWidth, height: Math.max(fromHeight, toHeight) })
			renderPages([
				...pagesRef.current.slice(0, -1),
				{ ...shown.current, height: fromHeight },
				{ id: nextId.current++, key, content, height: toHeight },
			])
		},
		[renderPages, showInstant],
	)

	useIsoLayoutEffect(() => {
		if (!ready) return
		if (requestedKey.current === null) {
			requestedKey.current = contentKey
			if (shown.current.content !== children) showInstant(children, contentKey)
			return
		}
		if (requestedKey.current === contentKey) {
			if (!turn.current && shown.current.content !== children) showInstant(children, contentKey)
			return
		}
		requestedKey.current = contentKey
		if (turn.current) {
			pending.current = { key: contentKey, content: children }
			return
		}
		beginTurn(children, contentKey)
	}, [beginTurn, children, contentKey, ready, showInstant])

	useIsoLayoutEffect(() => {
		const root = rootRef.current
		const measure = measureRef.current
		if (!root) return
		if (resetting.current) {
			bookRef.current?.turnTo(0)
			resetting.current = false
			if (measure) {
				restHeight.current = measure.offsetHeight
				setBookSize({ width: measure.offsetWidth, height: measure.offsetHeight })
			}
			const height = styleRef.current?.height
			root.style.height = typeof height === 'number' ? `${height}px` : (height ?? '')
			return
		}
		const active = turn.current
		if (active && bookRef.current?.page !== active.targetPage) {
			void bookRef.current?.flipTo(active.targetPage, 'bottom')
		}
	}, [pages])

	return (
		<div
			ref={rootRef}
			className={cn('rv-binder-peel', className)}
			style={style}
			data-turning={pages.length > 1 ? '' : undefined}
		>
			<div ref={measureRef} className="rv-binder-peel__measure" aria-hidden inert>
				{children}
			</div>
			{bookSize.width > 0 && bookSize.height > 0 && (
				<FlipBook
					ref={bookRef}
					className="rv-binder-peel__book"
					style={{ height: bookSize.height }}
					width={bookSize.width}
					height={bookSize.height}
					size="fixed"
					layout="single"
					autoSize={false}
					flipDuration={PEEL_MS}
					easing={easeInOutCubic}
					shadowOpacity={0.28}
					click="off"
					drag={false}
					swipe={false}
					hover={false}
					onFlip={({ page }) => {
						if (resetting.current || turn.current?.targetPage !== page) return
						const finished = turn.current
						const paper = pagesRef.current[page]
						if (!paper) return
						turn.current = null
						restHeight.current = finished.toHeight
						shown.current = paper
						const next = pending.current
						pending.current = null
						if (next) beginTurn(next.content, next.key)
						else showInstant(paper.content, finished.key)
					}}
					onFlipProgress={({ to, progress }) => {
						const active = turn.current
						const root = rootRef.current
						if (!active || !root || to !== active.targetPage) return
						const height = active.fromHeight + (active.toHeight - active.fromHeight) * progress
						root.style.height = `${height}px`
					}}
				>
					{pages.map((paper) => (
						<Page key={paper.id} density="soft">
							<div className="rv-binder-peel__page-content" style={{ height: paper.height }}>
								<div className="rv-binder-peel__paper">{paper.content}</div>
							</div>
						</Page>
					))}
				</FlipBook>
			)}
		</div>
	)
}
