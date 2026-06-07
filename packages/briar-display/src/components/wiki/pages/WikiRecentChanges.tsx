'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiLink from '@/components/wiki/common/WikiLink'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import type { WikiRecentChange } from '@briar/shared'
import { Clock, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 50

function formatTime(date: Date | string) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function formatSizeChange(before: number, after: number) {
	const diff = after - before
	if (diff > 0) {
		return (
			<span className="text-green-600">
				({diff > 0 ? '+' : ''}
				{diff})
			</span>
		)
	}
	if (diff < 0) {
		return <span className="text-red-600">({diff})</span>
	}
	return <span className="text-muted-foreground">(0)</span>
}

export default function WikiRecentChanges() {
	const [changes, setChanges] = useState<WikiRecentChange[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)

	const loadChanges = useCallback(async () => {
		setLoading(true)
		const res = await wikiApi.recentChanges(PAGE_SIZE, offset)
		if (res.success && res.data) {
			setChanges(res.data.items)
			setTotal(res.data.total)
		}
		setLoading(false)
	}, [offset])

	useEffect(() => {
		loadChanges()
	}, [loadChanges])

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '最近更改' }]} />

			<div className="flex items-center">
				<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
					<TrendingUp className="h-5 w-5" />
					最近更改
				</h2>
			</div>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 10 }).map((_, i) => (
						<div key={i} className="h-10 animate-pulse rounded bg-muted" />
					))}
				</div>
			) : changes.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<Clock className="h-10 w-10 opacity-30" />
					<p className="text-sm">暂无最近更改记录</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50">
								<th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
									时间
								</th>
								<th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
									页面
								</th>
								<th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
									编辑者
								</th>
								<th className="hidden whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground md:table-cell">
									摘要
								</th>
								<th className="hidden whitespace-nowrap px-3 py-2 text-right font-medium text-muted-foreground sm:table-cell">
									大小变化
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{changes.map((change, i) => (
								<tr
									key={`${change.pageId}-${change.revisionNumber}-${i}`}
									className="transition-colors hover:bg-muted/30"
								>
									<td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
										<span className="inline-flex items-center gap-1">
											<Clock className="h-3 w-3" />
											{formatTime(change.createdAt)}
										</span>
									</td>
									<td className="px-3 py-2">
										<WikiLink slug={change.pageSlug} title={change.pageTitle} />
									</td>
									<td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
										{change.editorName || change.editorId.slice(0, 8)}
									</td>
									<td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
										<span className="line-clamp-1">{change.summary || '—'}</span>
									</td>
									<td className="hidden whitespace-nowrap px-3 py-2 text-right sm:table-cell">
										{formatSizeChange(change.sizeBefore, change.sizeAfter)}
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
