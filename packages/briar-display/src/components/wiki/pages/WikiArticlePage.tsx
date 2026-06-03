'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiFooter from '@/components/wiki/layout/WikiFooter'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import { cn } from '@/lib/utils'
import type { WikiCategory, WikiPage } from '@briar/shared'
import {
	AlertTriangle,
	Calendar,
	ChevronDown,
	ChevronRight,
	Eye,
	FolderOpen,
	Loader2,
	RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface WikiArticlePageProps {
	slug: string
}

interface TocItem {
	id: string
	text: string
	level: number
}

/** Parse markdown headings to build a table of contents */
function extractToc(markdown: string): TocItem[] {
	const toc: TocItem[] = []
	const lines = markdown.split('\n')
	const slugCount: Record<string, number> = {}

	for (const line of lines) {
		const match = line.match(/^(#{2,4})\s+(.+)$/)
		if (match) {
			const level = match[1].length
			const text = match[2].replace(/[*_`~\[\]]/g, '').trim()
			let id = text
				.toLowerCase()
				.replace(/\s+/g, '-')
				.replace(/[^\w\u4e00-\u9fff-]/g, '')

			if (slugCount[id] !== undefined) {
				slugCount[id]++
				id = `${id}-${slugCount[id]}`
			} else {
				slugCount[id] = 0
			}

			toc.push({ id, text, level })
		}
	}

	return toc
}

/** Format a date to a localized string */
function formatDate(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

export default function WikiArticlePage({ slug }: WikiArticlePageProps) {
	const [page, setPage] = useState<WikiPage | null>(null)
	const [categories, setCategories] = useState<WikiCategory[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [tocOpen, setTocOpen] = useState(true)

	const fetchArticle = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await wikiApi.getBySlug(slug)
			if (res.success && res.data) {
				setPage(res.data)
			} else {
				setError(res.message || '文章未找到')
			}
		} catch {
			setError('加载文章时发生错误')
		} finally {
			setLoading(false)
		}
	}, [slug])

	useEffect(() => {
		fetchArticle()
	}, [fetchArticle])

	// Extract TOC from markdown content
	const toc = useMemo(() => {
		if (!page?.content) return []
		return extractToc(page.content)
	}, [page?.content])

	// Custom renderers for ReactMarkdown to add IDs to headings
	const markdownComponents = useMemo(
		() => ({
			h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
				const text = typeof children === 'string' ? children : ''
				const id = text
					.toLowerCase()
					.replace(/\s+/g, '-')
					.replace(/[^\w\u4e00-\u9fff-]/g, '')
				return (
					<h2 id={id} {...props}>
						{children}
					</h2>
				)
			},
			h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
				const text = typeof children === 'string' ? children : ''
				const id = text
					.toLowerCase()
					.replace(/\s+/g, '-')
					.replace(/[^\w\u4e00-\u9fff-]/g, '')
				return (
					<h3 id={id} {...props}>
						{children}
					</h3>
				)
			},
			h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
				const text = typeof children === 'string' ? children : ''
				const id = text
					.toLowerCase()
					.replace(/\s+/g, '-')
					.replace(/[^\w\u4e00-\u9fff-]/g, '')
				return (
					<h4 id={id} {...props}>
						{children}
					</h4>
				)
			},
		}),
		[],
	)

	// Loading state
	if (loading) {
		return (
			<div className="space-y-4">
				<WikiTabs slug={slug} activeTab="read" />
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					<span className="ml-2 text-muted-foreground">加载中...</span>
				</div>
			</div>
		)
	}

	// Error state
	if (error || !page) {
		return (
			<div className="space-y-4">
				<WikiTabs slug={slug} activeTab="read" />
				<div className="flex flex-col items-center justify-center py-20 text-center">
					<AlertTriangle className="mb-4 h-12 w-12 text-amber-500" />
					<h2 className="mb-2 text-xl font-semibold text-foreground">文章未找到</h2>
					<p className="mb-6 text-muted-foreground">{error || `不存在标题为「${slug}」的文章。`}</p>
					<div className="flex gap-3">
						<a
							href={`/briar-display/wiki/${slug}/edit`}
							className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
						>
							创建此文章
						</a>
						<a
							href="/briar-display/wiki/"
							className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
						>
							返回首页
						</a>
					</div>
				</div>
			</div>
		)
	}

	// Redirect notice
	if (page.isRedirect && page.redirectTarget) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: page.title }]} />
				<WikiTabs slug={slug} activeTab="read" />
				<div className="rounded-md border border-amber-200 bg-amber-50 p-4">
					<div className="flex items-center gap-2 text-amber-800">
						<RefreshCw className="h-4 w-4" />
						<span className="text-sm">
							此页面重定向至{' '}
							<a
								href={`/briar-display/wiki/${page.redirectTarget}`}
								className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
							>
								{page.redirectTarget}
							</a>
						</span>
					</div>
				</div>
				<div className="prose prose-sm max-w-none text-muted-foreground">
					<ReactMarkdown>{page.content}</ReactMarkdown>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{/* Breadcrumbs */}
			<WikiBreadcrumbs items={[{ label: page.title }]} />

			{/* Tabs */}
			<WikiTabs slug={slug} activeTab="read" />

			{/* Article title */}
			<h1 className="border-b border-border pb-3 font-serif text-2xl font-normal text-foreground">
				{page.title}
			</h1>

			{/* Table of Contents */}
			{toc.length > 0 && (
				<div className="rounded-md border border-border bg-gray-50">
					<button
						type="button"
						onClick={() => setTocOpen(!tocOpen)}
						className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-gray-100"
					>
						{tocOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
						目录
					</button>
					{tocOpen && (
						<nav className="border-t border-border px-4 py-3">
							<ul className="space-y-1">
								{toc.map((item) => (
									<li
										key={item.id}
										className={cn(
											'text-sm',
											item.level === 2 && 'pl-0',
											item.level === 3 && 'pl-4',
											item.level === 4 && 'pl-8',
										)}
									>
										<a
											href={`#${item.id}`}
											className="text-blue-600 hover:text-blue-800 hover:underline"
											onClick={(e) => {
												e.preventDefault()
												const el = document.getElementById(item.id)
												if (el) {
													el.scrollIntoView({ behavior: 'smooth', block: 'start' })
												}
											}}
										>
											{item.text}
										</a>
									</li>
								))}
							</ul>
						</nav>
					)}
				</div>
			)}

			{/* Article content */}
			<article className="prose prose-sm max-w-none">
				<ReactMarkdown components={markdownComponents}>{page.content}</ReactMarkdown>
			</article>

			{/* Categories */}
			{page.categories && page.categories.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
					<FolderOpen className="h-4 w-4 text-muted-foreground" />
					<span className="text-xs text-muted-foreground">分类：</span>
					{page.categories.map((cat) => (
						<a
							key={cat.id}
							href={`/briar-display/wiki/category/${cat.slug}`}
							className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 transition-colors hover:bg-blue-100"
						>
							{cat.name}
						</a>
					))}
				</div>
			)}

			{/* Article metadata footer */}
			<WikiFooter
				lastEditedAt={page.updatedAt}
				lastEditedBy={page.lastEditorId || undefined}
				viewCount={page.viewCount}
			/>

			{/* Metadata detail */}
			<div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
				<div className="flex items-center gap-1">
					<Calendar className="h-3.5 w-3.5" />
					<span>创建于 {formatDate(page.createdAt)}</span>
				</div>
				<div className="flex items-center gap-1">
					<Calendar className="h-3.5 w-3.5" />
					<span>最后更新 {formatDate(page.updatedAt)}</span>
				</div>
				<div className="flex items-center gap-1">
					<Eye className="h-3.5 w-3.5" />
					<span>{page.viewCount.toLocaleString()} 次浏览</span>
				</div>
			</div>
		</div>
	)
}
