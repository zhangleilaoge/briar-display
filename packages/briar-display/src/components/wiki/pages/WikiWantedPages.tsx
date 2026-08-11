'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import { cn } from '@/lib/utils'
import type { WikiWantedPage } from '@briar/shared'
import { ExternalLink, FileQuestion, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 50

export default function WikiWantedPages() {
	const [pages, setPages] = useState<WikiWantedPage[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadPages = useCallback(async () => {
		setLoading(true)
		setError(null)
		const res = await wikiApi.wantedPages(PAGE_SIZE, offset)
		if (res.success && res.data) {
			setPages(res.data.items)
			setTotal(res.data.total)
		} else {
			setError(res.message || '加载失败')
		}
		setLoading(false)
	}, [offset])

	useEffect(() => {
		loadPages()
	}, [loadPages])

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '期望页面' }]} />

			<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
				<FileQuestion className="h-5 w-5" />
				期望页面
			</h2>

			<p className="text-muted-foreground text-sm">
				以下页面被其他页面引用但尚未创建。你可以点击页面名来创建它。
			</p>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={i} className="h-10 animate-pulse rounded bg-muted" />
					))}
				</div>
			) : error ? (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
					{error}
				</div>
			) : pages.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<FileQuestion className="h-10 w-10 opacity-30" />
					<p className="text-sm">没有期望页面</p>
					<p className="text-xs">所有被引用的页面都已经存在</p>
				</div>
			) : (
				<div className="rounded-md border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50">
								<th className="px-4 py-2 text-left font-medium text-muted-foreground">页面名称</th>
								<th className="hidden px-4 py-2 text-right font-medium text-muted-foreground sm:table-cell">
									链接数
								</th>
								<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground md:table-cell">
									操作
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{pages.map((page) => (
								<tr key={page.slug} className="transition-colors hover:bg-muted/30">
									<td className="px-4 py-2">
										<a
											href={`/briar/wiki/new?title=${encodeURIComponent(page.slug)}`}
											className="border-b border-dashed border-red-500 text-red-600 transition-colors hover:text-red-800"
											title="点击创建此页面"
										>
											{page.slug}
										</a>
									</td>
									<td className="hidden whitespace-nowrap px-4 py-2 text-right text-muted-foreground sm:table-cell">
										{page.referenceCount}
									</td>
									<td className="hidden px-4 py-2 md:table-cell">
										<a
											href={`/briar/wiki/new?title=${encodeURIComponent(page.slug)}`}
											className="inline-flex items-center gap-1 text-primary text-xs transition-colors hover:text-primary/80"
										>
											<ExternalLink className="h-3 w-3" />
											创建此页面
										</a>
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
