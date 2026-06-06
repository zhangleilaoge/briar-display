'use client'

import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
	WikiCategoryTreeNode,
	WikiPageSummary,
	WikiRecentChange,
	WikiStatistics,
} from '@briar/shared'
import {
	BarChart3,
	Clock,
	Eye,
	FileEdit,
	FilePlus,
	FileText,
	FolderTree,
	Loader2,
	Shuffle,
	TrendingUp,
} from 'lucide-react'
import { useEffect, useState } from 'react'

/** Calculate relative time from now */
function relativeTime(date: string | Date): string {
	const now = Date.now()
	const d = typeof date === 'string' ? new Date(date) : date
	const diffMs = now - d.getTime()
	const diffSec = Math.floor(diffMs / 1000)
	if (diffSec < 60) return '刚刚'
	const diffMin = Math.floor(diffSec / 60)
	if (diffMin < 60) return `${diffMin}分钟前`
	const diffHour = Math.floor(diffMin / 60)
	if (diffHour < 24) return `${diffHour}小时前`
	const diffDay = Math.floor(diffHour / 24)
	return `${diffDay}天前`
}

export default function WikiHomePage() {
	const [stats, setStats] = useState<WikiStatistics | null>(null)
	const [recentChanges, setRecentChanges] = useState<WikiRecentChange[]>([])
	const [hotArticles, setHotArticles] = useState<WikiPageSummary[]>([])
	const [categories, setCategories] = useState<WikiCategoryTreeNode[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false

		Promise.all([
			wikiApi.list({ limit: 20, status: 'published' }),
			wikiApi.recentChanges(10),
			wikiApi.statistics(),
			wikiApi.getCategoryTree(),
		]).then(([listRes, recentRes, statsRes, catRes]) => {
			if (cancelled) return
			if (listRes.success && listRes.data) {
				const sorted = [...listRes.data.items].sort((a, b) => b.viewCount - a.viewCount)
				setHotArticles(sorted.slice(0, 5))
			}
			if (recentRes.success && recentRes.data) setRecentChanges(recentRes.data.items)
			if (statsRes.success && statsRes.data) setStats(statsRes.data)
			if (catRes.success && catRes.data) setCategories(catRes.data)
			setLoading(false)
		})

		return () => {
			cancelled = true
		}
	}, [])

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-8 w-8 animate-spin text-wiki-text-muted" />
				<span className="ml-2 text-wiki-text-muted">加载中...</span>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Two-column layout */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
				{/* Left column */}
				<div className="space-y-6 lg:col-span-8">
					{/* Hot articles */}
					{hotArticles.length > 0 && (
						<section className="rounded-sm border border-wiki-border-light bg-wiki-bg">
							<div className="flex items-center gap-2 border-b border-wiki-border-light px-4 py-2.5">
								<TrendingUp className="h-4 w-4 text-wiki-text-secondary" />
								<h2 className="text-[14px] font-semibold text-wiki-text">热门文章</h2>
							</div>
							<ul className="divide-y divide-wiki-border-light">
								{hotArticles.map((article) => (
									<li key={article.id}>
										<a
											href={`/briar-display/wiki/${article.slug}`}
											className="block px-4 py-3 transition-colors hover:bg-wiki-bg-secondary"
										>
											<h3 className="text-[14px] font-medium text-wiki-link hover:underline">
												{article.title}
											</h3>
											{article.summary && (
												<p className="mt-1 line-clamp-2 text-[13px] leading-[1.6] text-wiki-text-secondary">
													{article.summary}
												</p>
											)}
											<div className="mt-1.5 flex items-center gap-3 text-[12px] text-wiki-text-muted">
												<span className="flex items-center gap-1">
													<Eye className="h-3.5 w-3.5" />
													{article.viewCount.toLocaleString()}
												</span>
												<span className="flex items-center gap-1">
													<Clock className="h-3.5 w-3.5" />
													{relativeTime(article.updatedAt)}
												</span>
											</div>
										</a>
									</li>
								))}
							</ul>
						</section>
					)}

					{/* Recent edits */}
					<section className="rounded-sm border border-wiki-border-light bg-wiki-bg">
						<div className="flex items-center justify-between border-b border-wiki-border-light px-4 py-2.5">
							<div className="flex items-center gap-2">
								<FileEdit className="h-4 w-4 text-wiki-text-secondary" />
								<h2 className="text-[14px] font-semibold text-wiki-text">最近编辑</h2>
							</div>
							<a
								href="/briar-display/wiki/special/recent-changes"
								className="text-[12px] text-wiki-link hover:underline"
							>
								查看全部 →
							</a>
						</div>
						{recentChanges.length > 0 ? (
							<ul className="divide-y divide-wiki-border-light">
								{recentChanges.map((change) => (
									<li
										key={`${change.pageId}-${change.revisionNumber}`}
										className="flex items-center justify-between gap-3 px-4 py-2 text-[13px] transition-colors hover:bg-wiki-bg-secondary"
									>
										<div className="min-w-0 flex-1">
											<span className="text-wiki-text-secondary">
												{relativeTime(change.createdAt)}
											</span>
											<span className="mx-1.5 text-wiki-text-muted">·</span>
											<span className="font-medium text-wiki-text-secondary">
												{change.editorName || '匿名'}
											</span>
											<span className="mx-1.5 text-wiki-text-muted">编辑</span>
											<a
												href={`/briar-display/wiki/${change.pageSlug}`}
												className="font-medium text-wiki-link hover:underline"
											>
												{change.pageTitle}
											</a>
										</div>
									</li>
								))}
							</ul>
						) : (
							<div className="px-4 py-8 text-center text-[13px] text-wiki-text-muted">
								暂无最近更改
							</div>
						)}
					</section>
				</div>

				{/* Right column */}
				<div className="space-y-5 lg:col-span-4">
					{/* Wiki data */}
					{stats && (
						<section className="rounded-sm border border-wiki-border-light bg-wiki-bg p-4">
							<div className="mb-3 flex items-center gap-2">
								<BarChart3 className="h-4 w-4 text-wiki-text-secondary" />
								<h3 className="text-[14px] font-semibold text-wiki-text">Wiki 数据</h3>
							</div>
							<dl className="space-y-1.5 text-[13px]">
								<div className="flex justify-between">
									<dt className="text-wiki-text-secondary">文章</dt>
									<dd className="font-medium text-wiki-text">
										{stats.totalArticles.toLocaleString()}
									</dd>
								</div>
								<div className="flex justify-between">
									<dt className="text-wiki-text-secondary">编辑</dt>
									<dd className="font-medium text-wiki-text">
										{stats.totalRevisions.toLocaleString()}
									</dd>
								</div>
								<div className="flex justify-between">
									<dt className="text-wiki-text-secondary">分类</dt>
									<dd className="font-medium text-wiki-text">
										{stats.totalCategories.toLocaleString()}
									</dd>
								</div>
								<div className="flex justify-between">
									<dt className="text-wiki-text-secondary">用户</dt>
									<dd className="font-medium text-wiki-text">
										{stats.totalUsers.toLocaleString()}
									</dd>
								</div>
							</dl>
						</section>
					)}

					{/* Category tree */}
					{categories.length > 0 && (
						<section className="rounded-sm border border-wiki-border-light bg-wiki-bg p-4">
							<div className="mb-3 flex items-center gap-2">
								<FolderTree className="h-4 w-4 text-wiki-text-secondary" />
								<h3 className="text-[14px] font-semibold text-wiki-text">分类导航</h3>
							</div>
							<ul className="space-y-1">
								{categories.map((cat) => (
									<li key={cat.id}>
										<a
											href={`/briar-display/wiki/category/${cat.slug}`}
											className="flex items-center justify-between rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-wiki-bg-secondary"
										>
											<span className="text-wiki-link hover:underline">{cat.name}</span>
											<span className="text-[12px] text-wiki-text-muted">({cat.pageCount})</span>
										</a>
									</li>
								))}
							</ul>
						</section>
					)}

					{/* Quick actions */}
					<section className="rounded-sm border border-wiki-border-light bg-wiki-bg p-4">
						<h3 className="mb-3 text-[14px] font-semibold text-wiki-text">⚡ 快速操作</h3>
						<div className="flex flex-col gap-2">
							<a
								href="/briar-display/wiki/new"
								className="inline-flex items-center gap-2 rounded-sm border border-wiki-border-light px-3 py-2 text-[13px] text-wiki-link transition-colors hover:bg-wiki-bg-secondary hover:text-wiki-link-hover"
							>
								<FilePlus className="h-4 w-4" />📄 新建文章
							</a>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => {
									if (hotArticles.length > 0) {
										const random = hotArticles[Math.floor(Math.random() * hotArticles.length)]
										window.location.href = `/briar-display/wiki/${random.slug}`
									} else {
										window.location.href = '/briar-display/wiki/'
									}
								}}
								className="justify-start"
							>
								<Shuffle className="h-4 w-4" />🔀 随机页面
							</Button>
							<a
								href="/briar-display/wiki/special/all-pages"
								className="inline-flex items-center gap-2 rounded-sm border border-wiki-border-light px-3 py-2 text-[13px] text-wiki-link transition-colors hover:bg-wiki-bg-secondary hover:text-wiki-link-hover"
							>
								<FileText className="h-4 w-4" />
								所有页面
							</a>
						</div>
					</section>
				</div>
			</div>
		</div>
	)
}
