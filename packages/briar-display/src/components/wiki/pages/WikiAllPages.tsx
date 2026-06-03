'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiLink from '@/components/wiki/common/WikiLink'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import { cn } from '@/lib/utils'
import type { WikiPageSummary } from '@briar/shared'
import { FileText, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

const PAGE_SIZE = 100

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '其他']

function formatDate(date: Date | string) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
}

function getFirstChar(title: string): string {
	if (!title) return '其他'
	const first = title.charAt(0).toUpperCase()
	if (first >= 'A' && first <= 'Z') return first
	if (first >= 'a' && first <= 'z') return first.toUpperCase()
	if (first >= '0' && first <= '9') return '其他'
	return '其他'
}

export default function WikiAllPages() {
	const [pages, setPages] = useState<WikiPageSummary[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [activeLetter, setActiveLetter] = useState<string | null>(null)

	const loadPages = useCallback(async () => {
		setLoading(true)
		const res = await wikiApi.allPages(PAGE_SIZE, offset)
		if (res.success && res.data) {
			setPages(res.data.items)
			setTotal(res.data.total)
		}
		setLoading(false)
	}, [offset])

	useEffect(() => {
		loadPages()
	}, [loadPages])

	// Build letter index from current pages
	const availableLetters = useMemo(() => {
		const letters = new Set<string>()
		for (const page of pages) {
			letters.add(getFirstChar(page.title))
		}
		return letters
	}, [pages])

	// Filter by active letter
	const filteredPages = useMemo(() => {
		if (!activeLetter) return pages
		return pages.filter((p) => getFirstChar(p.title) === activeLetter)
	}, [pages, activeLetter])

	const handleLetterClick = (letter: string) => {
		if (activeLetter === letter) {
			setActiveLetter(null)
		} else {
			setActiveLetter(letter)
		}
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '所有页面' }]} />

			<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
				<FileText className="h-5 w-5" />
				所有页面
			</h2>

			<p className="text-muted-foreground text-sm">共 {total.toLocaleString()} 个页面</p>

			{/* Letter index */}
			<div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-2">
				{LETTERS.map((letter) => {
					const isAvailable = availableLetters.has(letter)
					const isActive = activeLetter === letter
					return (
						<button
							type="button"
							key={letter}
							onClick={() => isAvailable && handleLetterClick(letter)}
							disabled={!isAvailable}
							className={cn(
								'h-7 min-w-[28px] rounded px-1.5 font-mono text-xs transition-colors',
								isActive
									? 'bg-primary text-primary-foreground'
									: isAvailable
										? 'text-foreground hover:bg-muted'
										: 'cursor-not-allowed text-muted-foreground/30',
							)}
						>
							{letter}
						</button>
					)
				})}
			</div>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 10 }).map((_, i) => (
						<div key={i} className="h-10 animate-pulse rounded bg-muted" />
					))}
				</div>
			) : filteredPages.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<FileText className="h-10 w-10 opacity-30" />
					<p className="text-sm">
						{activeLetter ? `没有以 "${activeLetter}" 开头的页面` : '暂无页面'}
					</p>
				</div>
			) : (
				<div className="rounded-md border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50">
								<th className="px-4 py-2 text-left font-medium text-muted-foreground">页面标题</th>
								<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
									命名空间
								</th>
								<th className="hidden px-4 py-2 text-right font-medium text-muted-foreground md:table-cell">
									最后编辑
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{filteredPages.map((page) => (
								<tr key={page.id} className="transition-colors hover:bg-muted/30">
									<td className="px-4 py-2">
										<WikiLink slug={page.slug} title={page.title} />
									</td>
									<td className="hidden px-4 py-2 sm:table-cell">
										{page.namespace !== 'main' && (
											<span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
												{page.namespace}
											</span>
										)}
									</td>
									<td className="hidden px-4 py-2 text-right text-muted-foreground md:table-cell">
										{formatDate(page.updatedAt)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<WikiPagination
				total={total}
				limit={PAGE_SIZE}
				offset={offset}
				onPageChange={(newOffset) => {
					setOffset(newOffset)
					setActiveLetter(null)
				}}
			/>
		</div>
	)
}
