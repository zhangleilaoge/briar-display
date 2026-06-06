'use client'

import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export interface TocItem {
	id: string
	text: string
	level: number
}

interface ArticleTocProps {
	toc: TocItem[]
}

export default function ArticleToc({ toc }: ArticleTocProps) {
	const [open, setOpen] = useState(true)

	if (toc.length === 0) return null

	return (
		<div className="w-[200px] shrink-0">
			<div className="sticky top-4 rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-4">
				<button
					type="button"
					onClick={() => setOpen(!open)}
					className="flex w-full items-center gap-2 text-left text-[13px] font-semibold text-wiki-text"
				>
					{open ? (
						<ChevronDown className="h-3.5 w-3.5" />
					) : (
						<ChevronRight className="h-3.5 w-3.5" />
					)}
					目录
				</button>
				{open && (
					<nav className="mt-2">
						<ul className="space-y-0.5">
							{toc.map((item) => (
								<li
									key={item.id}
									className={cn(
										'text-[12px] leading-[1.6]',
										item.level === 2 && 'pl-0',
										item.level === 3 && 'pl-3',
										item.level === 4 && 'pl-6',
									)}
								>
									<a
										href={`#${item.id}`}
										className="text-wiki-link hover:underline"
										onClick={(e) => {
											e.preventDefault()
											const el = document.getElementById(item.id)
											if (el) {
												el.scrollIntoView({ behavior: 'smooth', block: 'start' })
											}
										}}
									>
										{item.text}
									</a>
								</li>
							))}
						</ul>
					</nav>
				)}
			</div>
		</div>
	)
}
