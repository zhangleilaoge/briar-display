import { Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FlatJsonEntry } from './toolJsonUtils'

interface JsonSearchDropdownProps {
	flatEntries: FlatJsonEntry[]
	onSelect: (entry: FlatJsonEntry) => void
}

export default function JsonSearchDropdown({ flatEntries, onSelect }: JsonSearchDropdownProps) {
	const [query, setQuery] = useState('')
	const [showDropdown, setShowDropdown] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	const results = useMemo(() => {
		if (!query.trim()) return []
		const q = query.toLowerCase()
		return flatEntries
			.filter((e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q))
			.slice(0, 20)
	}, [flatEntries, query])

	const handleSelect = useCallback(
		(entry: FlatJsonEntry) => {
			setShowDropdown(false)
			setQuery('')
			onSelect(entry)
		},
		[onSelect],
	)

	useEffect(() => {
		if (!showDropdown) return
		const handleClick = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setShowDropdown(false)
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [showDropdown])

	return (
		<div ref={containerRef} className="relative">
			<div className="relative">
				<Search className="absolute top-1/2 left-1.5 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
				<input
					type="text"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value)
						setShowDropdown(true)
					}}
					onFocus={() => setShowDropdown(true)}
					placeholder="搜索 key / value…"
					className="h-6 w-36 rounded-md border bg-background py-0.5 pr-2 pl-6 text-xs placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
				/>
			</div>
			{showDropdown && query && (
				<div className="absolute top-full right-0 z-50 mt-1 max-h-60 w-72 overflow-auto rounded-md border bg-popover shadow-md">
					{results.length > 0 ? (
						results.map((entry, i) => (
							<button
								key={`${entry.path}-${i}`}
								onClick={() => handleSelect(entry)}
								className="flex w-full flex-col gap-0.5 border-b px-3 py-1.5 text-left transition-colors last:border-b-0 hover:bg-accent"
							>
								<span className="truncate font-mono text-[11px] text-foreground">
									{entry.key}
									<span className="text-muted-foreground">: </span>
									<span className="text-blue-600">{entry.value}</span>
								</span>
								<span className="truncate text-[10px] text-muted-foreground">{entry.path}</span>
							</button>
						))
					) : (
						<div className="px-3 py-4 text-center text-xs text-muted-foreground">无匹配结果</div>
					)}
				</div>
			)}
		</div>
	)
}
