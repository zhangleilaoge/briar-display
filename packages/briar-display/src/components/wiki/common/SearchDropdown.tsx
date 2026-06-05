'use client'

import { wikiApi } from '@/api/wiki'
import { cn } from '@/lib/utils'
import { Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SearchResult {
	slug: string
	title: string
	namespace?: string
}

interface SearchDropdownProps {
	onSelect?: (slug: string) => void
	className?: string
}

export default function SearchDropdown({ onSelect, className }: SearchDropdownProps) {
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<SearchResult[]>([])
	const [loading, setLoading] = useState(false)
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const doSearch = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([])
			setOpen(false)
			return
		}
		setLoading(true)
		try {
			const res = await wikiApi.search(q.trim(), 5)
			if (res.success && res.data?.items) {
				setResults(
					res.data.items.map((item) => ({
						slug: item.slug,
						title: item.title,
						namespace: item.namespace,
					})),
				)
			} else {
				setResults([])
			}
			setOpen(true)
		} catch {
			setResults([])
			setOpen(true)
		} finally {
			setLoading(false)
		}
	}, [])

	const handleChange = useCallback(
		(value: string) => {
			setQuery(value)
			if (debounceRef.current) clearTimeout(debounceRef.current)
			debounceRef.current = setTimeout(() => doSearch(value), 300)
		},
		[doSearch],
	)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter' && query.trim()) {
				e.preventDefault()
				if (onSelect) {
					onSelect(query.trim())
				} else {
					window.location.href = `/briar-display/wiki/search?q=${encodeURIComponent(query.trim())}`
				}
				setOpen(false)
			}
			if (e.key === 'Escape') {
				setOpen(false)
			}
		},
		[query, onSelect],
	)

	const handleSelectResult = useCallback(
		(slug: string) => {
			setOpen(false)
			setQuery('')
			if (onSelect) {
				onSelect(slug)
			} else {
				window.location.href = `/briar-display/wiki/${slug}`
			}
		},
		[onSelect],
	)

	// Close on outside click
	useEffect(() => {
		if (!open) return
		const handleClick = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [open])

	return (
		<div ref={containerRef} className={cn('relative', className)}>
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wiki-text-muted" />
				<input
					type="text"
					value={query}
					onChange={(e) => handleChange(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => results.length > 0 && setOpen(true)}
					placeholder="搜索文章..."
					className="h-8 w-full rounded border border-wiki-border-light bg-wiki-bg-secondary pl-9 pr-3 text-[13px] text-wiki-text outline-none transition-colors placeholder:text-wiki-text-muted focus:border-wiki-link focus:bg-wiki-bg"
				/>
				{loading && (
					<Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-wiki-text-muted" />
				)}
			</div>

			{open && query.trim() && (
				<div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-wiki-border-light bg-wiki-bg shadow-lg">
					{results.length > 0 ? (
						results.map((item) => (
							<button
								key={`${item.namespace || 'main'}:${item.slug}`}
								type="button"
								onClick={() => handleSelectResult(item.slug)}
								className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors hover:bg-wiki-bg-tertiary"
							>
								<span className="truncate text-wiki-link">{item.title}</span>
								{item.namespace && item.namespace !== 'main' && (
									<span className="ml-2 flex-shrink-0 rounded bg-wiki-bg-tertiary px-1.5 py-0.5 text-[10px] text-wiki-text-muted">
										{item.namespace}
									</span>
								)}
							</button>
						))
					) : (
						<div className="px-3 py-2 text-[13px] text-wiki-text-muted">无搜索结果</div>
					)}
				</div>
			)}
		</div>
	)
}
