'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import { cn } from '@/lib/utils'
import type { WikiWatchlistItem } from '@briar/shared'
import { AlertCircle, Bookmark, Loader2, Trash2 } from 'lucide-react'
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

function isLoggedIn(): boolean {
	if (typeof window === 'undefined') return false
	return !!localStorage.getItem('briar_token')
}

// Extended type for enriched watchlist items from API
interface WatchlistDisplayItem extends WikiWatchlistItem {
	pageTitle?: string
	pageSlug?: string
	lastEditedAt?: Date | string
	lastEditorId?: string
}

export default function WikiWatchlist() {
	const [items, setItems] = useState<WatchlistDisplayItem[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [removingSlug, setRemovingSlug] = useState<string | null>(null)
	const authenticated = isLoggedIn()

	const loadWatchlist = useCallback(async () => {
		if (!authenticated) {
			setLoading(false)
			return
		}
		setLoading(true)
		setError(null)
		const res = await wikiApi.getWatchlist(PAGE_SIZE, offset)
		if (res.success && res.data) {
			setItems(res.data.items as WatchlistDisplayItem[])
			setTotal(res.data.total)
		} else {
			setError(res.message || '加载关注列表失败')
		}
		setLoading(false)
	}, [offset, authenticated])

	useEffect(() => {
		loadWatchlist()
	}, [loadWatchlist])

	const handleRemove = async (slug: string) => {
		setRemovingSlug(slug)
		const res = await wikiApi.removeFromWatchlist(slug)
		if (res.success) {
			await loadWatchlist()
		} else {
			setError(res.message || '取消关注失败')
		}
		setRemovingSlug(null)
	}

	if (!authenticated) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: '关注列表' }]} />

				<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
					<Bookmark className="h-5 w-5" />
					关注列表
				</h2>

				<div className="flex flex-col items-center gap-4 py-12">
					<div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 text-sm">
						<AlertCircle className="h-4 w-4 flex-shrink-0" />
						<span>
							请先
							<a href="/briar/login" className="mx-1 font-medium text-amber-800 underline">
								登录
							</a>
							后查看关注列表
						</span>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '关注列表' }]} />

			<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
				<Bookmark className="h-5 w-5" />
				关注列表
			</h2>

			<p className="text-muted-foreground text-sm">你关注的页面出现变更时，会在最近更改中标记。</p>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="h-12 animate-pulse rounded bg-muted" />
					))}
				</div>
			) : error ? (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
					{error}
				</div>
			) : items.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<Bookmark className="h-10 w-10 opacity-30" />
					<p className="text-sm">暂无关注的页面</p>
					<p className="text-xs">在文章页面点击"关注"按钮来添加关注</p>
				</div>
			) : (
				<div className="rounded-md border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50">
								<th className="px-4 py-2 text-left font-medium text-muted-foreground">页面标题</th>
								<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
									最后编辑
								</th>
								<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground md:table-cell">
									关注时间
								</th>
								<th className="px-4 py-2 text-right font-medium text-muted-foreground">操作</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{items.map((item) => {
								const slug = item.pageSlug || item.pageId
								const title = item.pageTitle || item.pageId
								const isRemoving = removingSlug === slug

								return (
									<tr key={item.pageId} className="transition-colors hover:bg-muted/30">
										<td className="px-4 py-2">
											<a
												href={`/briar/wiki/${slug}`}
												className="text-blue-600 transition-colors hover:text-blue-800 hover:underline"
											>
												{title}
											</a>
										</td>
										<td className="hidden whitespace-nowrap px-4 py-2 text-muted-foreground sm:table-cell">
											{item.lastEditedAt ? formatDate(item.lastEditedAt) : '—'}
										</td>
										<td className="hidden whitespace-nowrap px-4 py-2 text-muted-foreground md:table-cell">
											{formatDate(item.createdAt)}
										</td>
										<td className="px-4 py-2 text-right">
											<button
												type="button"
												onClick={() => handleRemove(slug)}
												disabled={isRemoving}
												className={cn(
													'inline-flex items-center gap-1 rounded-md px-2 py-1 text-red-600 text-xs transition-colors hover:bg-red-50',
													isRemoving && 'cursor-not-allowed opacity-50',
												)}
												title="取消关注"
											>
												{isRemoving ? (
													<Loader2 className="h-3 w-3 animate-spin" />
												) : (
													<Trash2 className="h-3 w-3" />
												)}
												取消关注
											</button>
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
