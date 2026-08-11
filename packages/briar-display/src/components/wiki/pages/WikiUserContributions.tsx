'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import type { WikiUserContribution } from '@briar/shared'
import { AlertCircle, History, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 30

function formatDate(date: Date | string) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function formatSizeDiff(before: number, after: number): string {
	const diff = after - before
	if (diff === 0) return '0'
	return diff > 0 ? `+${diff}` : `${diff}`
}

function getUserId(): string | null {
	try {
		const raw = localStorage.getItem('briar_user')
		if (!raw) return null
		const user = JSON.parse(raw)
		return user?.id || null
	} catch {
		return null
	}
}

function isLoggedIn(): boolean {
	if (typeof window === 'undefined') return false
	return !!localStorage.getItem('briar_token')
}

export default function WikiUserContributions() {
	const [items, setItems] = useState<WikiUserContribution[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const authenticated = isLoggedIn()

	const loadContributions = useCallback(async () => {
		if (!authenticated) {
			setLoading(false)
			return
		}
		const userId = getUserId()
		if (!userId) {
			setError('无法获取用户信息')
			setLoading(false)
			return
		}
		setLoading(true)
		setError(null)
		const res = await wikiApi.userContributions(userId, PAGE_SIZE, offset)
		if (res.success && res.data) {
			setItems(res.data.items)
			setTotal(res.data.total)
		} else {
			setError(res.message || '加载贡献列表失败')
		}
		setLoading(false)
	}, [offset, authenticated])

	useEffect(() => {
		loadContributions()
	}, [loadContributions])

	if (!authenticated) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: '我的贡献' }]} />

				<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
					<History className="h-5 w-5" />
					我的贡献
				</h2>

				<div className="flex flex-col items-center gap-4 py-12">
					<div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
						<AlertCircle className="h-4 w-4 flex-shrink-0" />
						<span>
							请先
							<a href="/briar/login" className="mx-1 font-medium text-amber-800 underline">
								登录
							</a>
							后查看贡献记录
						</span>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '我的贡献' }]} />

			<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
				<History className="h-5 w-5" />
				我的贡献
			</h2>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="h-12 animate-pulse rounded bg-muted" />
					))}
				</div>
			) : error ? (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : items.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<History className="h-10 w-10 opacity-30" />
					<p className="text-sm">暂无贡献记录</p>
					<p className="text-xs">编辑文章后，你的贡献会显示在这里</p>
				</div>
			) : (
				<div className="rounded-md border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50">
								<th className="px-4 py-2 text-left font-medium text-muted-foreground">页面</th>
								<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
									版本
								</th>
								<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground md:table-cell">
									编辑摘要
								</th>
								<th className="px-4 py-2 text-right font-medium text-muted-foreground">大小变化</th>
								<th className="hidden px-4 py-2 text-right font-medium text-muted-foreground lg:table-cell">
									时间
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{items.map((item) => {
								const diff = formatSizeDiff(item.sizeBefore, item.sizeAfter)
								const isPositive = item.sizeAfter >= item.sizeBefore

								return (
									<tr
										key={`${item.pageId}-${item.revisionNumber}`}
										className="transition-colors hover:bg-muted/30"
									>
										<td className="px-4 py-2">
											<a
												href={`/briar/wiki/${item.pageSlug}`}
												className="text-blue-600 transition-colors hover:text-blue-800 hover:underline"
											>
												{item.pageTitle}
											</a>
										</td>
										<td className="hidden whitespace-nowrap px-4 py-2 text-muted-foreground sm:table-cell">
											#{item.revisionNumber}
										</td>
										<td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
											{item.summary || '—'}
										</td>
										<td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs">
											<span className={isPositive ? 'text-green-600' : 'text-red-600'}>{diff}</span>
										</td>
										<td className="hidden whitespace-nowrap px-4 py-2 text-right text-muted-foreground lg:table-cell">
											{formatDate(item.createdAt)}
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			<WikiPagination total={total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
		</div>
	)
}
