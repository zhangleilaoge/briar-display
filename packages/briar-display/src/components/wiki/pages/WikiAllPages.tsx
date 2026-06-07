'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiLink from '@/components/wiki/common/WikiLink'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import { WikiInput as Input } from '@/components/wiki/common/ui/input'
import type { WikiPageSummary } from '@briar/shared'
import { FileText, Loader2, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 100

function formatDate(date: Date | string) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
}

export default function WikiAllPages() {
	const [pages, setPages] = useState<WikiPageSummary[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	const loadPages = useCallback(async () => {
		setLoading(true)
		if (query.trim()) {
			const res = await wikiApi.search(query.trim(), PAGE_SIZE, offset)
			if (res.success && res.data) {
				setPages(res.data.items)
				setTotal(res.data.total)
			}
		} else {
			const res = await wikiApi.allPages(PAGE_SIZE, offset)
			if (res.success && res.data) {
				setPages(res.data.items)
				setTotal(res.data.total)
			}
		}
		setLoading(false)
	}, [offset, query])

	useEffect(() => {
		loadPages()
	}, [loadPages])

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '所有页面' }]} />

			<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
				<FileText className="h-5 w-5" />
				所有页面
			</h2>

			<p className="text-muted-foreground text-sm">共 {total.toLocaleString()} 个页面</p>

			{/* Search */}
			<div className="flex items-center gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wiki-text-muted" />
					<Input
						value={query}
						onChange={(e) => {
							setQuery(e.target.value)
							setOffset(0)
						}}
						placeholder="搜索页面标题..."
						className="pl-9"
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								loadPages()
							}
						}}
					/>
				</div>
				{query && (
					<button
						type="button"
						onClick={() => {
							setQuery('')
							setOffset(0)
						}}
						className="inline-flex h-8 items-center gap-1 rounded-sm border border-wiki-border-light px-3 text-[13px] text-wiki-text transition-colors hover:bg-wiki-bg-secondary"
					>
						<X className="h-3.5 w-3.5" />
						清除
					</button>
				)}
			</div>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 10 }).map((_, i) => (
						<div key={i} className="h-10 animate-pulse rounded bg-muted" />
					))}
				</div>
			) : pages.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<FileText className="h-10 w-10 opacity-30" />
					<p className="text-sm">{query.trim() ? '未找到匹配的页面' : '暂无页面'}</p>
				</div>
			) : (
				<div className="rounded-md border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50">
								<th className="px-4 py-2 text-left font-medium text-muted-foreground">页面标题</th>
								<th className="hidden px-4 py-2 text-right font-medium text-muted-foreground md:table-cell">
									最后编辑
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{pages.map((page) => (
								<tr key={page.id} className="transition-colors hover:bg-muted/30">
									<td className="px-4 py-2">
										<WikiLink slug={page.slug} title={page.title} />
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

			<WikiPagination total={total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
		</div>
	)
}
