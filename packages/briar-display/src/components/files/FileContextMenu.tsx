'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
	label: string
	icon?: ReactNode
	danger?: boolean
	onClick: () => void
}

interface FileContextMenuProps {
	x: number
	y: number
	items: ContextMenuItem[]
	onClose: () => void
}

/** 轻量右键菜单：挂到 body，点击外部 / Esc / 窗口失焦关闭 */
export default function FileContextMenu({ x, y, items, onClose }: FileContextMenuProps) {
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleMouseDown = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) onClose()
		}
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('mousedown', handleMouseDown)
		document.addEventListener('keydown', handleKeyDown)
		window.addEventListener('blur', onClose)
		window.addEventListener('resize', onClose)
		return () => {
			document.removeEventListener('mousedown', handleMouseDown)
			document.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('blur', onClose)
			window.removeEventListener('resize', onClose)
		}
	}, [onClose])

	// 防止菜单超出视口
	const menuHeight = items.length * 36 + 12
	const left = Math.max(8, Math.min(x, window.innerWidth - 192))
	const top = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8))

	return createPortal(
		<div
			ref={ref}
			style={{ left, top }}
			data-state="open"
			className="rv-paper-float rv-float-motion fixed z-[200] w-48 overflow-visible p-1"
		>
			{items.map((item) => (
				<button
					key={item.label}
					type="button"
					onClick={() => {
						onClose()
						item.onClick()
					}}
					className={`flex w-full items-center gap-2 border-b border-[color:var(--rv-navy)]/10 px-2 py-2 text-left text-sm last:border-0 transition-colors hover:bg-[hsl(214_55%_92%/0.7)] ${
						item.danger ? 'text-destructive' : 'text-[color:var(--rv-ink)]'
					}`}
				>
					{item.icon}
					{item.label}
				</button>
			))}
		</div>,
		document.body,
	)
}
