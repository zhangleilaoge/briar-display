'use client'

import { wikiApi } from '@/api/wiki'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import type { WikiPageSummary } from '@briar/shared'
import { FileText, Loader2, Star, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 20

export default function WikiStarsList() {
	const [pages, setPages] = useState<WikiPageSummary[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchStars = useCallback(async (newOffset: number) => {
		setLoading(true)
		try {
			const res = await wikiApi.getStars(PAGE_SIZE, newOffset)
			if (res.success && res.data) {
				setPages(res.data.items as WikiPageSummary[])
				setTotal(res.data.total)
				setOffset(newOffset)
			} else {
				setError(res.message || '加载收藏失败')
			}
		} catch {
			setError('加载收藏时发生错误')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchStars(0)
	}, [fetchStars])

	const handleRemoveStar = useCallback(
		async (slug: string) => {
			try {
				await wikiApi.removeStar(slug)
				fetchStars(offset)
			} catch {
				// silently fail
			}
		},
		[offset, fetchStars],
	)

	const handlePageChange = useCallback(
		(newOffset: number) => {
			fetchStars(newOffset)
			window.scrollTo({ top: 0, behavior: 'smooth' })
		},
		[fetchStars],
	)

	if (loading && pages.length === 0) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-8 w-8 animate-spin text-wiki-text-muted" />
				<span className="ml-2 text-wiki-text-muted">加载中...</span>
			</div>
		)
	}

	if (error) {
		return (
			<div className="rounded-sm border border-wiki-highlight bg-wiki-highlight px-4 py-3 text-[13px] text-wiki-link-red">
				{error}
			</div>
		)
	}

	return (
		<div className="space-y-5">
			<h1 className="border-b border-wiki-border-light pb-2 text-[1.5em] font-normal text-wiki-text">
				我的收藏
			</h1>

			{pages.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<Star className="mb-4 h-12 w-12 text-wiki-text-muted/30" />
					<h3 className="mb-1 text-[15px] font-medium text-wiki-text">暂无收藏</h3>
					<p className="text-[13px] text-wiki-text-secondary">
						在文章页面点击「收藏」按钮即可添加收藏。
					</p>
				</div>
			) : (
				<>
					<p className="text-[13px] text-wiki-text-secondary">
						共 <span className="font-medium text-wiki-text">{total}</span> 个收藏
					</p>

					<ul className="divide-y divide-wiki-border-light rounded-sm border border-wiki-border-light bg-wiki-bg">
						{pages.map((page) => (
							<li key={page.id} className="flex items-center gap-3 px-5 py-3">
								<Star className="h-4 w-4 shrink-0 fill-wiki-link text-wiki-link" />
								<a
									href={`/briar-display/wiki/${page.slug}`}
									className="min-w-0 flex-1 text-[14px] text-wiki-link hover:underline"
								>
									<div className="flex items-center gap-2">
										<FileText className="h-3.5 w-3.5 shrink-0 text-wiki-text-muted" />
										<span className="truncate">{page.title}</span>
									</div>
								</a>
								<button
									type="button"
									onClick={() => handleRemoveStar(page.slug)}
									className="shrink-0 rounded-sm p-1 text-wiki-text-muted transition-colors hover:text-wiki-link-red"
									title="取消收藏"
								>
									<Trash2 className="h-3.5 w-3.5" />
								</button>
							</li>
						))}
					</ul>

					<WikiPagination
						total={total}
						limit={PAGE_SIZE}
						offset={offset}
						onPageChange={handlePageChange}
					/>
				</>
			)}
		</div>
	)
}
