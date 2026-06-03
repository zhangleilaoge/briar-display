'use client'

import { wikiApi } from '@/api/wiki'
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
	Search,
	Star,
	TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

function formatDate(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function formatSizeChange(before: number, after: number): string {
	const diff = after - before
	if (diff > 0) return `+${diff}`
	return `${diff}`
}

export default function WikiHomePage() {
	const [stats, setStats] = useState<WikiStatistics | null>(null)
	const [recentChanges, setRecentChanges] = useState<WikiRecentChange[]>([])
	const [featuredArticle, setFeaturedArticle] = useState<WikiPageSummary | null>(null)
	const [categories, setCategories] = useState<WikiCategoryTreeNode[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false

		Promise.all([
			wikiApi.statistics(),
			wikiApi.recentChanges(10),
			wikiApi.list({ limit: 1, status: 'published' }),
			wikiApi.getCategoryTree(),
		]).then(([statsRes, recentRes, listRes, catRes]) => {
			if (cancelled) return
			if (statsRes.success && statsRes.data) setStats(statsRes.data)
			if (recentRes.success && recentRes.data) setRecentChanges(recentRes.data.items)
			if (listRes.success && listRes.data && listRes.data.items.length > 0) {
				setFeaturedArticle(listRes.data.items[0])
			}
			if (catRes.success && catRes.data) setCategories(catRes.data)
			setLoading(false)
		})

		return () => {
			cancelled = true
		}
	}, [])

	const handleSearch = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (searchQuery.trim()) {
				window.history.pushState(
					{},
					'',
					`/briar-display/wiki/search?q=${encodeURIComponent(searchQuery.trim())}`,
				)
				window.dispatchEvent(new PopStateEvent('popstate'))
			}
		},
		[searchQuery],
	)

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<span className="ml-2 text-muted-foreground">加载中...</span>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Search bar - Wikipedia style */}
			<div className="flex justify-center">
				<form onSubmit={handleSearch} className="relative w-full max-w-2xl">
					<Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="搜索 Briar Wiki..."
						className="w-full rounded-lg border border-border bg-white py-3 pl-12 pr-4 text-base shadow-sm transition-shadow focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</form>
			</div>

			{/* Two-column layout */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
				{/* Left column (65%) */}
				<div className="space-y-6 lg:col-span-8">
					{/* Featured article */}
					{featuredArticle && (
						<section className="rounded-md border border-border bg-white p-5">
							<div className="mb-3 flex items-center gap-2">
								<Star className="h-4 w-4 text-amber-500" />
								<h2 className="text-base font-semibold text-foreground">推荐阅读</h2>
							</div>
							<div>
								<a
									href={`/briar-display/wiki/${featuredArticle.slug}`}
									className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
								>
									{featuredArticle.title}
								</a>
								{featuredArticle.summary && (
									<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
										{featuredArticle.summary}
									</p>
								)}
								<div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
									<span className="flex items-center gap-1">
										<Eye className="h-3.5 w-3.5" />
										{featuredArticle.viewCount.toLocaleString()} 浏览
									</span>
									<span className="flex items-center gap-1">
										<Clock className="h-3.5 w-3.5" />
										{formatDate(featuredArticle.updatedAt)}
									</span>
								</div>
							</div>
						</section>
					)}

					{/* Recent edits */}
					<section className="rounded-md border border-border bg-white">
						<div className="flex items-center justify-between border-b border-border px-5 py-3">
							<div className="flex items-center gap-2">
								<TrendingUp className="h-4 w-4 text-muted-foreground" />
								<h2 className="text-base font-semibold text-foreground">最近更改</h2>
							</div>
							<a
								href="/briar-display/wiki/special/recent-changes"
								className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
							>
								查看全部 →
							</a>
						</div>
						{recentChanges.length > 0 ? (
							<ul className="divide-y divide-border">
								{recentChanges.map((change) => (
									<li key={`${change.pageId}-${change.revisionNumber}`}>
										<a
											href={`/briar-display/wiki/${change.pageSlug}`}
											className="flex items-start justify-between gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
										>
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<span className="truncate font-medium text-blue-600">
														{change.pageTitle}
													</span>
													{change.minorEdit && (
														<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
															小
														</span>
													)}
												</div>
												{change.summary && (
													<p className="mt-0.5 truncate text-xs text-muted-foreground">
														{change.summary}
													</p>
												)}
												<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
													<span>{change.editorName || '匿名'}</span>
													<span>·</span>
													<span
														className={cn(
															'font-mono',
															change.sizeAfter - change.sizeBefore > 0
																? 'text-green-600'
																: change.sizeAfter - change.sizeBefore < 0
																	? 'text-red-600'
																	: '',
														)}
													>
														{formatSizeChange(change.sizeBefore, change.sizeAfter)} 字节
													</span>
												</div>
											</div>
											<span className="shrink-0 text-xs text-muted-foreground">
												{formatDate(change.createdAt)}
											</span>
										</a>
									</li>
								))}
							</ul>
						) : (
							<div className="px-5 py-8 text-center text-sm text-muted-foreground">
								暂无最近更改
							</div>
						)}
					</section>
				</div>

				{/* Right column (35%) */}
				<div className="space-y-5 lg:col-span-4">
					{/* Wiki stats box */}
					{stats && (
						<section className="rounded-md border border-border bg-white p-4">
							<div className="mb-3 flex items-center gap-2">
								<BarChart3 className="h-4 w-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold text-foreground">Wiki 统计</h3>
							</div>
							<dl className="space-y-2">
								<div className="flex items-center justify-between">
									<dt className="text-xs text-muted-foreground">文章数</dt>
									<dd className="text-sm font-medium text-foreground">
										{stats.totalArticles.toLocaleString()}
									</dd>
								</div>
								<div className="flex items-center justify-between">
									<dt className="text-xs text-muted-foreground">编辑次数</dt>
									<dd className="text-sm font-medium text-foreground">
										{stats.totalRevisions.toLocaleString()}
									</dd>
								</div>
								<div className="flex items-center justify-between">
									<dt className="text-xs text-muted-foreground">分类数</dt>
									<dd className="text-sm font-medium text-foreground">
										{stats.totalCategories.toLocaleString()}
									</dd>
								</div>
								<div className="flex items-center justify-between">
									<dt className="text-xs text-muted-foreground">模板数</dt>
									<dd className="text-sm font-medium text-foreground">
										{stats.totalTemplates.toLocaleString()}
									</dd>
								</div>
								<div className="flex items-center justify-between">
									<dt className="text-xs text-muted-foreground">24h 编辑</dt>
									<dd className="text-sm font-medium text-foreground">
										{stats.recentEdits24h.toLocaleString()}
									</dd>
								</div>
							</dl>
						</section>
					)}

					{/* Category navigation */}
					{categories.length > 0 && (
						<section className="rounded-md border border-border bg-white p-4">
							<div className="mb-3 flex items-center gap-2">
								<FolderTree className="h-4 w-4 text-muted-foreground" />
								<h3 className="text-sm font-semibold text-foreground">分类导航</h3>
							</div>
							<ul className="space-y-1">
								{categories.map((cat) => (
									<li key={cat.id}>
										<a
											href={`/briar-display/wiki/category/${cat.slug}`}
											className="flex items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted"
										>
											<span className="text-blue-600 hover:text-blue-800">{cat.name}</span>
											<span className="text-xs text-muted-foreground">{cat.pageCount}</span>
										</a>
										{cat.children.length > 0 && (
											<ul className="ml-4 space-y-0.5">
												{cat.children.map((child) => (
													<li key={child.id}>
														<a
															href={`/briar-display/wiki/category/${child.slug}`}
															className="flex items-center justify-between rounded px-2 py-1 text-xs transition-colors hover:bg-muted"
														>
															<span className="text-blue-600 hover:text-blue-800">
																{child.name}
															</span>
															<span className="text-muted-foreground">{child.pageCount}</span>
														</a>
													</li>
												))}
											</ul>
										)}
									</li>
								))}
							</ul>
						</section>
					)}

					{/* Quick links */}
					<section className="rounded-md border border-border bg-white p-4">
						<h3 className="mb-3 text-sm font-semibold text-foreground">快速链接</h3>
						<ul className="space-y-1">
							<li>
								<a
									href="/briar-display/wiki/special/all-pages"
									className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-blue-600 transition-colors hover:bg-muted hover:text-blue-800"
								>
									<FileText className="h-4 w-4" />
									所有页面
								</a>
							</li>
							<li>
								<a
									href="/briar-display/wiki/category/"
									className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-blue-600 transition-colors hover:bg-muted hover:text-blue-800"
								>
									<FolderTree className="h-4 w-4" />
									分类
								</a>
							</li>
							<li>
								<a
									href="/briar-display/wiki/special/recent-changes"
									className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-blue-600 transition-colors hover:bg-muted hover:text-blue-800"
								>
									<FileEdit className="h-4 w-4" />
									最近更改
								</a>
							</li>
							<li>
								<a
									href="/briar-display/wiki/new"
									className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-blue-600 transition-colors hover:bg-muted hover:text-blue-800"
								>
									<FilePlus className="h-4 w-4" />
									新建文章
								</a>
							</li>
						</ul>
					</section>
				</div>
			</div>
		</div>
	)
}
