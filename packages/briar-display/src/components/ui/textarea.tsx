import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					'flex min-h-[80px] w-full rounded-field border border-input bg-card/80 px-3 py-2 text-base transition-shadow md:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
Textarea.displayName = 'Textarea'

type ResizableTextareaProps = React.ComponentProps<'textarea'> & {
	wrapperClassName?: string
}

/** 浏览器原生缩放手柄不支持自定义光标，用可拖拽手柄覆盖并保持键盘可调。 */
const ResizableTextarea = React.forwardRef<HTMLTextAreaElement, ResizableTextareaProps>(
	({ className, wrapperClassName, ...props }, forwardedRef) => {
		const innerRef = React.useRef<HTMLTextAreaElement>(null)
		const dragRef = React.useRef<{ pointerId: number; startY: number; startHeight: number } | null>(
			null,
		)

		const setRef = (node: HTMLTextAreaElement | null) => {
			innerRef.current = node
			if (typeof forwardedRef === 'function') forwardedRef(node)
			else if (forwardedRef) forwardedRef.current = node
		}

		const resizeTo = (height: number) => {
			const textarea = innerRef.current
			if (!textarea) return
			const minHeight = Number.parseFloat(window.getComputedStyle(textarea).minHeight) || 80
			textarea.style.height = `${Math.min(Math.max(height, minHeight), window.innerHeight * 0.8)}px`
		}

		return (
			<div className={cn('relative', wrapperClassName)}>
				<Textarea ref={setRef} className={cn(className, 'resize-none')} {...props} />
				<button
					type="button"
					aria-label="调整输入框高度"
					className="rv-textarea-resizer absolute bottom-0.5 right-0.5 h-4 w-4 cursor-nwse-resize touch-none rounded-sm opacity-45 transition-opacity hover:opacity-80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					onPointerDown={(event) => {
						const textarea = innerRef.current
						if (!textarea || event.button !== 0) return
						event.preventDefault()
						event.currentTarget.setPointerCapture(event.pointerId)
						dragRef.current = {
							pointerId: event.pointerId,
							startY: event.clientY,
							startHeight: textarea.getBoundingClientRect().height,
						}
					}}
					onPointerMove={(event) => {
						const drag = dragRef.current
						if (!drag || drag.pointerId !== event.pointerId) return
						resizeTo(drag.startHeight + event.clientY - drag.startY)
					}}
					onPointerUp={(event) => {
						if (dragRef.current?.pointerId !== event.pointerId) return
						dragRef.current = null
						if (event.currentTarget.hasPointerCapture(event.pointerId)) {
							event.currentTarget.releasePointerCapture(event.pointerId)
						}
					}}
					onLostPointerCapture={() => {
						dragRef.current = null
					}}
					onKeyDown={(event) => {
						const textarea = innerRef.current
						if (!textarea || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
						event.preventDefault()
						resizeTo(
							textarea.getBoundingClientRect().height + (event.key === 'ArrowDown' ? 16 : -16),
						)
					}}
				/>
			</div>
		)
	},
)
ResizableTextarea.displayName = 'ResizableTextarea'

export { ResizableTextarea, Textarea }
