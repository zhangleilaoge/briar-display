'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiLink from '@/components/wiki/common/WikiLink'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import { cn } from '@/lib/utils'
import type { WikiPageSummary } from '@briar/shared'
import { Eye, FileText, Link2, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 50

function formatDate(date: Date | string) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
}

export default function WikiOrphanedPages() {
	const [pages, setPages] = useState<WikiPageSummary[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadPages = useCallback(async () => {
		setLoading(true)
		setError(null)
		const res = await wikiApi.orphanedPages(PAGE_SIZE, offset)
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
			<WikiBreadcrumbs items={[{ label: '孤立页面' }]} />

			<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
				<Link2 className="h-5 w-5" />
				孤立页面
			</h2>

			<p className="text-muted-foreground text-sm">
				这些页面没有被其他页面引用，可能需要添加链接以提高可发现性。
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
					<Link2 className="h-10 w-10 opacity-30" />
					<p className="text-sm">没有找到孤立页面</p>
					<p className="text-xs">所有页面都至少被一个其他页面引用</p>
				</div>
			) : (
				<div className="rounded-md border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50">
								<th className="px-4 py-2 text-left font-medium text-muted-foreground">页面标题</th>
								<th className="hidden px-4 py-2 text-right font-medium text-muted-foreground sm:table-cell">
									最后编辑
								</th>
								<th className="hidden px-4 py-2 text-right font-medium text-muted-foreground md:table-cell">
									浏览量
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{pages.map((page) => (
								<tr key={page.id} className="transition-colors hover:bg-muted/30">
									<td className="px-4 py-2">
										<div className="flex items-center gap-2">
											<FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
											<WikiLink slug={page.slug} title={page.title} />
										</div>
									</td>
									<td className="hidden whitespace-nowrap px-4 py-2 text-right text-muted-foreground sm:table-cell">
										{formatDate(page.updatedAt)}
									</td>
									<td className="hidden whitespace-nowrap px-4 py-2 text-right text-muted-foreground md:table-cell">
										<span className="inline-flex items-center gap-1">
											<Eye className="h-3 w-3" />
											{page.viewCount.toLocaleString()}
										</span>
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
