'use client'

/**
 * 想法正文输入框：输入 `#` 时按已有标签联想（↑↓ 选择，Enter/Tab 补全，Esc 关闭）。
 * 通过 ref.insertHash() 在光标处插入 `#`（「# 标签」按钮用）。
 */
import { ResizableTextarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'

export type TagTextareaHandle = { insertHash: () => void }

type Props = {
	value: string
	onChange: (value: string) => void
	maxLength: number
	/** 已有标签（热门在前） */
	knownTags: string[]
	placeholder?: string
	autoFocus?: boolean
	className?: string
}

/** 光标前正在输入的 `#xxx`（仅当 # 前为行首/空白/标点） */
function activeQuery(text: string, caret: number): { start: number; query: string } | null {
	const before = text.slice(0, caret)
	const m = before.match(/(^|[^\p{L}\p{N}_#&/])#([\p{L}\p{N}_]{0,32})$/u)
	if (!m) return null
	return { start: caret - m[2]!.length - 1, query: m[2]!.toLowerCase() }
}

export const TagTextarea = forwardRef<TagTextareaHandle, Props>(function TagTextarea(
	{ value, onChange, maxLength, knownTags, placeholder, autoFocus, className },
	ref,
) {
	const taRef = useRef<HTMLTextAreaElement>(null)
	const [caret, setCaret] = useState<number | null>(null)
	const [index, setIndex] = useState(0)
	const [dismissed, setDismissed] = useState(false)

	const q = caret == null ? null : activeQuery(value, caret)
	const suggestions = useMemo(() => {
		if (!q) return []
		return knownTags.filter((t) => t.startsWith(q.query) && t !== q.query).slice(0, 6)
	}, [q?.query, q, knownTags])
	const open = !dismissed && suggestions.length > 0

	const setCaretAt = (pos: number) => {
		requestAnimationFrame(() => {
			const el = taRef.current
			if (!el) return
			el.focus()
			el.setSelectionRange(pos, pos)
			setCaret(pos)
		})
	}

	const apply = (tag: string) => {
		if (!q || caret == null) return
		const insert = `#${tag} `
		const next = (value.slice(0, q.start) + insert + value.slice(caret)).slice(0, maxLength)
		onChange(next)
		setCaretAt(Math.min(q.start + insert.length, next.length))
	}

	useImperativeHandle(ref, () => ({
		insertHash: () => {
			const el = taRef.current
			const pos = el ? el.selectionStart : value.length
			const before = value.slice(0, pos)
			const needSpace = before.length > 0 && !/\s$/.test(before)
			const insert = `${needSpace ? ' ' : ''}#`
			const next = (before + insert + value.slice(pos)).slice(0, maxLength)
			onChange(next)
			setDismissed(false)
			setCaretAt(Math.min(pos + insert.length, next.length))
		},
	}))

	const sync = () => {
		const el = taRef.current
		if (el) setCaret(el.selectionStart)
	}

	return (
		<div className="relative">
			<ResizableTextarea
				ref={taRef}
				value={value}
				autoFocus={autoFocus}
				onChange={(e) => {
					onChange(e.target.value.slice(0, maxLength))
					setCaret(e.target.selectionStart)
					setDismissed(false)
					setIndex(0)
				}}
				onSelect={sync}
				onClick={sync}
				onBlur={() => setTimeout(() => setDismissed(true), 120)}
				onFocus={() => setDismissed(false)}
				onKeyDown={(e) => {
					if (!open) return
					if (e.key === 'ArrowDown') {
						e.preventDefault()
						setIndex((i) => (i + 1) % suggestions.length)
					} else if (e.key === 'ArrowUp') {
						e.preventDefault()
						setIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
					} else if (e.key === 'Enter' || e.key === 'Tab') {
						e.preventDefault()
						apply(suggestions[Math.min(index, suggestions.length - 1)]!)
					} else if (e.key === 'Escape') {
						setDismissed(true)
					}
				}}
				placeholder={placeholder}
				rows={4}
				className={className}
			/>
			{open && (
				<ul className="absolute left-2 top-full z-20 mt-1 min-w-[10rem] border border-[color:var(--rv-rose)]/60 bg-[var(--rv-beige)] py-1 text-sm shadow-lg">
					{suggestions.map((t, i) => (
						<li key={t}>
							<button
								type="button"
								data-active={i === index}
								onMouseDown={(e) => {
									e.preventDefault()
									apply(t)
								}}
								className={cn(
									'block w-full px-3 py-1 text-left text-[color:var(--rv-rose-deep)]',
									i === index ? 'bg-[var(--rv-pink)]/70' : 'hover:bg-[var(--rv-pink)]/40',
								)}
							>
								#{t}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
})
