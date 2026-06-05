'use client'

import { wikiApi } from '@/api/wiki'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface TagInputProps {
	value: string[]
	onChange: (tags: string[]) => void
	placeholder?: string
}

interface WikiTag {
	id: string
	name: string
	slug: string
	color: string
	pageCount: number
}

export default function TagInput({
	value,
	onChange,
	placeholder = '输入标签，按回车添加',
}: TagInputProps) {
	const [input, setInput] = useState('')
	const [suggestions, setSuggestions] = useState<WikiTag[]>([])
	const [allTags, setAllTags] = useState<WikiTag[]>([])
	const [highlighted, setHighlighted] = useState(-1)
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// Load all tags for autocomplete
	useEffect(() => {
		wikiApi.getTags().then((res) => {
			if (res.success && res.data) {
				setAllTags(res.data)
			}
		})
	}, [])

	// Filter suggestions
	useEffect(() => {
		const trimmed = input.trim().toLowerCase()
		if (!trimmed) {
			setSuggestions([])
			setOpen(false)
			return
		}
		const filtered = allTags
			.filter((t) => t.name.toLowerCase().includes(trimmed))
			.filter((t) => !value.includes(t.name))
			.slice(0, 8)
		setSuggestions(filtered)
		setOpen(filtered.length > 0)
		setHighlighted(-1)
	}, [input, allTags, value])

	// Close dropdown on outside click
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [])

	const addTag = useCallback(
		(tagName: string) => {
			const trimmed = tagName.trim()
			if (!trimmed || value.includes(trimmed)) return
			onChange([...value, trimmed])
			setInput('')
			setOpen(false)
			inputRef.current?.focus()
		},
		[value, onChange],
	)

	const removeTag = useCallback(
		(tag: string) => {
			onChange(value.filter((t) => t !== tag))
		},
		[value, onChange],
	)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				e.preventDefault()
				if (highlighted >= 0 && suggestions[highlighted]) {
					addTag(suggestions[highlighted].name)
				} else if (input.trim()) {
					addTag(input)
				}
			} else if (e.key === ',' || e.key === '，') {
				e.preventDefault()
				if (input.trim()) {
					addTag(input)
				}
			} else if (e.key === 'Backspace' && !input && value.length > 0) {
				onChange(value.slice(0, -1))
			} else if (e.key === 'ArrowDown') {
				e.preventDefault()
				setHighlighted((prev) => Math.min(prev + 1, suggestions.length - 1))
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				setHighlighted((prev) => Math.max(prev - 1, -1))
			} else if (e.key === 'Escape') {
				setOpen(false)
			}
		},
		[input, highlighted, suggestions, value, onChange, addTag],
	)

	return (
		<div ref={containerRef} className="relative">
			<div
				className={cn(
					'flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-sm border border-wiki-border bg-wiki-bg px-2 py-1.5',
					'focus-within:border-wiki-link focus-within:ring-1 focus-within:ring-wiki-link',
				)}
				onClick={() => inputRef.current?.focus()}
			>
				{value.map((tag) => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 rounded-full bg-wiki-link/10 px-2.5 py-0.5 text-[12px] text-wiki-link"
					>
						{tag}
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation()
								removeTag(tag)
							}}
							className="rounded-full p-0.5 hover:bg-wiki-link/20"
						>
							<X className="h-3 w-3" />
						</button>
					</span>
				))}
				<input
					ref={inputRef}
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={value.length === 0 ? placeholder : ''}
					className="min-w-[80px] flex-1 bg-transparent py-1 text-[14px] text-wiki-text placeholder:text-wiki-text-muted focus:outline-none"
				/>
			</div>

			{open && suggestions.length > 0 && (
				<div className="absolute z-50 mt-1 w-full rounded-sm border border-wiki-border bg-wiki-bg shadow-lg">
					{suggestions.map((tag, idx) => (
						<button
							key={tag.id}
							type="button"
							onClick={() => addTag(tag.name)}
							className={cn(
								'flex w-full items-center px-3 py-2 text-left text-[13px] transition-colors',
								idx === highlighted
									? 'bg-wiki-bg-tertiary text-wiki-text'
									: 'text-wiki-text-secondary hover:bg-wiki-bg-tertiary hover:text-wiki-text',
							)}
						>
							<span className="rounded-full bg-wiki-link/10 px-2 py-0.5 text-[12px] text-wiki-link">
								{tag.name}
							</span>
							<span className="ml-2 text-[11px] text-wiki-text-muted">{tag.pageCount} 篇文章</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}
