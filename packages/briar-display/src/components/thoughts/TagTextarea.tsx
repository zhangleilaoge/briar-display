'use client'

/**
 * 想法正文输入框：输入 `#` 时按已有标签联想（↑↓ 选择，Enter/Tab 补全，Esc 关闭）。
 * 通过 ref.insertHash() 在光标处插入 `#`（「# 标签」按钮用）。
 */
import { ResizableTextarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'

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

const MIRROR_PROPS = [
	'boxSizing',
	'width',
	'borderTopWidth',
	'borderRightWidth',
	'borderBottomWidth',
	'borderLeftWidth',
	'paddingTop',
	'paddingRight',
	'paddingBottom',
	'paddingLeft',
	'fontStyle',
	'fontVariant',
	'fontWeight',
	'fontStretch',
	'fontSize',
	'fontFamily',
	'lineHeight',
	'letterSpacing',
	'textTransform',
	'wordSpacing',
	'textIndent',
	'tabSize',
] as const

/** mirror-div：返回光标相对 textarea 左上角的坐标（已扣除滚动） */
function caretCoords(
	el: HTMLTextAreaElement,
	pos: number,
): { left: number; top: number; height: number } {
	const cs = window.getComputedStyle(el)
	const div = document.createElement('div')
	const st = div.style
	for (const k of MIRROR_PROPS) st[k] = cs[k]
	st.position = 'absolute'
	st.visibility = 'hidden'
	st.top = '0'
	st.left = '-9999px'
	st.whiteSpace = 'pre-wrap'
	st.overflowWrap = 'break-word'
	st.wordBreak = cs.wordBreak
	div.textContent = el.value.slice(0, pos)
	const span = document.createElement('span')
	span.textContent = el.value.slice(pos) || '.'
	div.appendChild(span)
	document.body.appendChild(div)
	const lh = Number.parseFloat(cs.lineHeight) || Number.parseFloat(cs.fontSize) * 1.5
	const r = {
		left: span.offsetLeft + Number.parseFloat(cs.borderLeftWidth) - el.scrollLeft,
		top: span.offsetTop + Number.parseFloat(cs.borderTopWidth) - el.scrollTop,
		height: lh,
	}
	document.body.removeChild(div)
	return r
}

export const TagTextarea = forwardRef<TagTextareaHandle, Props>(function TagTextarea(
	{ value, onChange, maxLength, knownTags, placeholder, autoFocus, className },
	ref,
) {
	const taRef = useRef<HTMLTextAreaElement>(null)
	const [caret, setCaret] = useState<number | null>(null)
	const [index, setIndex] = useState(0)
	const [dismissed, setDismissed] = useState(false)

	const q = useMemo(() => (caret == null ? null : activeQuery(value, caret)), [value, caret])
	const suggestions = useMemo(() => {
		if (!q) return []
		return knownTags.filter((t) => t.startsWith(q.query) && t !== q.query).slice(0, 6)
	}, [q, knownTags])
	const open = !dismissed && suggestions.length > 0
	const listId = useId()
	const listRef = useRef<HTMLDivElement>(null)
	const boxRef = useRef<HTMLDivElement>(null)
	const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)

	const place = useCallback(() => {
		const el = taRef.current
		const list = listRef.current
		if (!el || !q) return
		const c = caretCoords(el, q.start)
		const w = list?.offsetWidth ?? 160
		const h = list?.offsetHeight ?? 120
		const rect = el.getBoundingClientRect()
		const box = boxRef.current?.getBoundingClientRect() ?? rect
		const dx = rect.left - box.left
		const dy = rect.top - box.top
		const left = dx + Math.max(0, Math.min(c.left, el.clientWidth - w))
		const below = c.top + c.height + 4
		const roomBelow = window.innerHeight - (rect.top + below)
		const above = roomBelow < h + 8 && rect.top + c.top > h + 8
		const top = dy + (above ? c.top - h - 4 : below)
		setPos((p) =>
			p && p.left === left && p.top === top && p.above === above ? p : { left, top, above },
		)
	}, [q])

	useLayoutEffect(() => {
		if (open) place()
	}, [open, place, value, caret, suggestions.length])

	useEffect(() => {
		if (!open) return
		const el = taRef.current
		window.addEventListener('resize', place)
		window.addEventListener('scroll', place, true)
		el?.addEventListener('scroll', place)
		return () => {
			window.removeEventListener('resize', place)
			window.removeEventListener('scroll', place, true)
			el?.removeEventListener('scroll', place)
		}
	}, [open, place])

	useEffect(() => {
		if (index >= suggestions.length) setIndex(0)
	}, [index, suggestions.length])

	useEffect(() => {
		if (!open) return
		listRef.current
			?.querySelector<HTMLElement>(`[data-index="${index}"]`)
			?.scrollIntoView({ block: 'nearest' })
	}, [index, open])

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
		setIndex(0)
		setDismissed(true)
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
		<div ref={boxRef} className="relative">
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
				onClick={sync}
				onBlur={() => setTimeout(() => setDismissed(true), 120)}
				onFocus={() => setDismissed(false)}
				onKeyDown={(e) => {
					if (!open || e.nativeEvent.isComposing) return
					if (e.key === 'ArrowDown') {
						e.preventDefault()
						e.stopPropagation()
						setIndex((i) => (i + 1) % suggestions.length)
					} else if (e.key === 'ArrowUp') {
						e.preventDefault()
						e.stopPropagation()
						setIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
					} else if (e.key === 'Enter' || e.key === 'Tab') {
						e.preventDefault()
						e.stopPropagation()
						apply(suggestions[Math.min(index, suggestions.length - 1)]!)
					} else if (e.key === 'Escape') {
						e.preventDefault()
						e.stopPropagation()
						setDismissed(true)
					}
				}}
				onKeyUp={(e) => {
					// 方向键在弹层打开时不应改变光标（否则 onSelect 会重置）
					if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) sync()
				}}
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				aria-activedescendant={open ? `${listId}-${index}` : undefined}
				placeholder={placeholder}
				rows={4}
				className={className}
			/>
			{open && (
				<div
					ref={listRef}
					id={listId}
					// biome-ignore lint/a11y/useSemanticElements: 自定义 combobox 弹层
					role="listbox"
					tabIndex={-1}
					aria-label="标签联想"
					style={
						pos ? { left: pos.left, top: pos.top } : { left: 8, top: '100%', visibility: 'hidden' }
					}
					className="absolute z-20 max-h-52 min-w-[10rem] max-w-[min(16rem,100%)] overflow-y-auto rounded-sm border border-[color:var(--rv-rose-deep)]/25 bg-[var(--rv-beige)] py-1 text-sm shadow-[0_6px_18px_-6px_rgba(28,43,75,0.25)]"
				>
					{suggestions.map((t, i) => (
						<div
							key={t}
							id={`${listId}-${i}`}
							// biome-ignore lint/a11y/useSemanticElements: 自定义 combobox 选项
							role="option"
							tabIndex={-1}
							aria-selected={i === index}
							data-index={i}
							onMouseEnter={() => setIndex(i)}
							onMouseDown={(e) => {
								e.preventDefault()
								apply(t)
							}}
							className={cn(
								'flex min-h-8 cursor-pointer items-center truncate px-3 text-left text-[13px] text-[color:var(--rv-rose-deep)]',
								i === index &&
									'bg-[color:color-mix(in_srgb,var(--rv-rose)_65%,transparent)] font-medium',
							)}
						>
							#{t}
						</div>
					))}
				</div>
			)}
		</div>
	)
})
