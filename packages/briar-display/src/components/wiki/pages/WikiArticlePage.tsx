'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiFooter from '@/components/wiki/layout/WikiFooter'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import { cn } from '@/lib/utils'
import type { WikiCategory, WikiPage } from '@briar/shared'
import {
	AlertTriangle,
	ChevronDown,
	ChevronRight,
	Eye,
	FolderOpen,
	Loader2,
	Pencil,
	RefreshCw,
	Star,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface WikiArticlePageProps {
	slug: string
}

/** Extended page type with optional categories from API */
interface WikiPageWithCategories extends WikiPage {
	categories?: Pick<WikiCategory, 'id' | 'name' | 'slug'>[]
}

interface TocItem {
	id: string
	text: string
	level: number
}

/** Slugify heading text into an ID */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^\w\u4e00-\u9fff-]/g, '')
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
			let id = slugify(text)

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

/** Extract infobox content from markdown (first table after first heading) */
function extractInfobox(markdown: string): string | null {
	const lines = markdown.split('\n')
	let foundFirstHeading = false
	let inTable = false
	const tableLines: string[] = []

	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.match(/^#{1,4}\s+/)) {
			foundFirstHeading = true
			if (inTable && tableLines.length > 0) break
			continue
		}
		if (foundFirstHeading && trimmed.startsWith('|') && trimmed.endsWith('|')) {
			inTable = true
			tableLines.push(trimmed)
		} else if (inTable) {
			if (tableLines.length > 0) break
		}
	}

	return tableLines.length >= 2 ? tableLines.join('\n') : null
}

/** Format a date to a localized string */
function formatDate(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})
}

export default function WikiArticlePage({ slug }: WikiArticlePageProps) {
	const [page, setPage] = useState<WikiPageWithCategories | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [tocOpen, setTocOpen] = useState(true)
	const [watching, setWatching] = useState(false)
	const [watchLoading, setWatchLoading] = useState(false)

	const fetchArticle = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await wikiApi.getBySlug(slug)
			if (res.success && res.data) {
				setPage(res.data as WikiPageWithCategories)
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

	// Check watchlist status
	useEffect(() => {
		if (!page) return
		let cancelled = false
		wikiApi.isWatching(slug).then((res) => {
			if (!cancelled && res.success && res.data) {
				setWatching(res.data.watching)
			}
		})
		return () => {
			cancelled = true
		}
	}, [slug, page])

	const handleToggleWatch = useCallback(async () => {
		setWatchLoading(true)
		try {
			if (watching) {
				await wikiApi.removeFromWatchlist(slug)
				setWatching(false)
			} else {
				await wikiApi.addToWatchlist(slug)
				setWatching(true)
			}
		} catch {
			// silently fail
		} finally {
			setWatchLoading(false)
		}
	}, [slug, watching])

	// Extract TOC from markdown content
	const toc = useMemo(() => {
		if (!page?.content) return []
		return extractToc(page.content)
	}, [page?.content])

	// Extract infobox from markdown
	const infoboxContent = useMemo(() => {
		if (!page?.content) return null
		return extractInfobox(page.content)
	}, [page?.content])

	// Remove infobox table from main content if present
	const mainContent = useMemo(() => {
		if (!page?.content) return ''
		if (!infoboxContent) return page.content

		const lines = page.content.split('\n')
		const result: string[] = []
		let foundFirstHeading = false
		let skippingTable = false

		for (const line of lines) {
			const trimmed = line.trim()
			if (trimmed.match(/^#{1,4}\s+/)) {
				foundFirstHeading = true
				if (skippingTable) {
					skippingTable = false
				}
				result.push(line)
				continue
			}
			if (foundFirstHeading && !skippingTable && trimmed.startsWith('|') && trimmed.endsWith('|')) {
				skippingTable = true
				continue
			}
			if (skippingTable) {
				if (!trimmed.startsWith('|')) {
					skippingTable = false
					result.push(line)
				}
				continue
			}
			result.push(line)
		}

		return result.join('\n')
	}, [page?.content, infoboxContent])

	// Custom renderers for ReactMarkdown to add IDs to headings
	const markdownComponents = useMemo(
		() => ({
			h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
				const text = typeof children === 'string' ? children : extractText(children)
				const id = slugify(text)
				return (
					<h2 id={id} {...props}>
						<span className="group relative">
							{children}
							<a
								href={`/briar-display/wiki/${slug}/edit`}
								className="float-right ml-2 mt-1 inline-flex items-center gap-1 text-[12px] font-normal text-wiki-text-muted opacity-0 transition-opacity hover:text-wiki-link group-hover:opacity-100"
							>
								<Pencil className="h-3 w-3" />
								编辑
							</a>
						</span>
					</h2>
				)
			},
			h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
				const text = typeof children === 'string' ? children : extractText(children)
				const id = slugify(text)
				return (
					<h3 id={id} {...props}>
						<span className="group relative">
							{children}
							<a
								href={`/briar-display/wiki/${slug}/edit`}
								className="float-right ml-2 mt-0.5 inline-flex items-center gap-1 text-[11px] font-normal text-wiki-text-muted opacity-0 transition-opacity hover:text-wiki-link group-hover:opacity-100"
							>
								<Pencil className="h-2.5 w-2.5" />
								编辑
							</a>
						</span>
					</h3>
				)
			},
			h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
				const text = typeof children === 'string' ? children : extractText(children)
				const id = slugify(text)
				return (
					<h4 id={id} {...props}>
						{children}
					</h4>
				)
			},
			a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
				if (href?.startsWith('/') || href?.startsWith('#')) {
					return (
						<a href={href} className="wiki-link" {...props}>
							{children}
						</a>
					)
				}
				return (
					<a href={href} className="wiki-link" target="_blank" rel="noopener noreferrer" {...props}>
						{children}
					</a>
				)
			},
		}),
		[slug],
	)

	// Loading state
	if (loading) {
		return (
			<div className="space-y-4">
				<WikiTabs slug={slug} active="read" />
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-wiki-text-muted" />
					<span className="ml-2 text-wiki-text-muted">加载中...</span>
				</div>
			</div>
		)
	}

	// Error state / 404
	if (error || !page) {
		return (
			<div className="space-y-4">
				<WikiTabs slug={slug} active="read" />
				<div className="flex flex-col items-center justify-center py-20 text-center">
					<AlertTriangle className="mb-4 h-12 w-12 text-wiki-text-muted" />
					<h2 className="mb-2 text-xl font-semibold text-wiki-text">此页面尚不存在</h2>
					<p className="mb-6 text-[14px] text-wiki-text-secondary">
						{error || `不存在标题为「${slug}」的文章。你可以创建它。`}
					</p>
					<div className="flex gap-3">
						<a
							href={`/briar-display/wiki/${slug}/edit`}
							className="inline-flex items-center gap-2 rounded-sm bg-wiki-link px-4 py-2 text-[13px] text-white transition-colors hover:bg-wiki-link-hover"
						>
							创建此文章
						</a>
						<a
							href="/briar-display/wiki/"
							className="inline-flex items-center gap-2 rounded-sm border border-wiki-border-light px-4 py-2 text-[13px] text-wiki-text transition-colors hover:bg-wiki-bg-secondary"
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
				<WikiTabs slug={slug} active="read" />
				<div className="rounded-sm border border-wiki-highlight bg-wiki-highlight p-4">
					<div className="flex items-center gap-2 text-wiki-link-red">
						<RefreshCw className="h-4 w-4" />
						<span className="text-[13px]">
							此页面重定向至{' '}
							<a
								href={`/briar-display/wiki/${page.redirectTarget}`}
								className="font-medium text-wiki-link hover:underline"
							>
								{page.redirectTarget}
							</a>
						</span>
					</div>
				</div>
				<div className="prose prose-wiki max-w-none">
					<ReactMarkdown>{page.content}</ReactMarkdown>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{/* Breadcrumbs + Watch */}
			<div className="flex items-center justify-between">
				<WikiBreadcrumbs items={[{ label: page.title }]} />
				<button
					type="button"
					onClick={handleToggleWatch}
					disabled={watchLoading}
					className={cn(
						'inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12px] transition-colors',
						watching
							? 'border-wiki-link bg-wiki-link/10 text-wiki-link'
							: 'border-wiki-border-light text-wiki-text-secondary hover:border-wiki-link hover:text-wiki-link',
					)}
				>
					<Star className={cn('h-3.5 w-3.5', watching && 'fill-wiki-link')} />
					{watching ? '已关注' : '关注'}
				</button>
			</div>

			{/* Tabs */}
			<WikiTabs slug={slug} active="read" />

			{/* Article title */}
			<h1 className="border-b border-wiki-border-light pb-2 text-[1.8em] font-normal leading-[1.3] text-wiki-text">
				{page.title}
			</h1>

			{/* Main content area with optional TOC and Infobox */}
			<div className="flex gap-6">
				{/* Table of Contents */}
				{toc.length > 0 && (
					<div className="w-[200px] shrink-0">
						<div className="sticky top-4 rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-4">
							<button
								type="button"
								onClick={() => setTocOpen(!tocOpen)}
								className="flex w-full items-center gap-2 text-left text-[13px] font-semibold text-wiki-text"
							>
								{tocOpen ? (
									<ChevronDown className="h-3.5 w-3.5" />
								) : (
									<ChevronRight className="h-3.5 w-3.5" />
								)}
								目录
							</button>
							{tocOpen && (
								<nav className="mt-2">
									<ul className="space-y-0.5">
										{toc.map((item) => (
											<li
												key={item.id}
												className={cn(
													'text-[12px] leading-[1.6]',
													item.level === 2 && 'pl-0',
													item.level === 3 && 'pl-3',
													item.level === 4 && 'pl-6',
												)}
											>
												<a
													href={`#${item.id}`}
													className="text-wiki-link hover:underline"
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
					</div>
				)}

				{/* Article body */}
				<div className="min-w-0 flex-1">
					{/* Infobox floating right */}
					{infoboxContent && (
						<div className="float-right ml-4 mb-4 w-[280px] rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-4">
							<div className="prose prose-wiki max-w-none text-[12px]">
								<ReactMarkdown>{infoboxContent}</ReactMarkdown>
							</div>
						</div>
					)}

					{/* Article content */}
					<article className="prose prose-wiki max-w-none">
						<ReactMarkdown components={markdownComponents}>{mainContent}</ReactMarkdown>
					</article>
				</div>
			</div>

			{/* Categories */}
			{page.categories && page.categories.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 border-t border-wiki-border-light pt-4">
					<FolderOpen className="h-4 w-4 text-wiki-text-muted" />
					<span className="text-[12px] text-wiki-text-muted">分类：</span>
					{page.categories.map((cat) => (
						<a
							key={cat.id}
							href={`/briar-display/wiki/category/${cat.slug}`}
							className="inline-flex items-center rounded-full bg-wiki-link/10 px-2.5 py-0.5 text-[12px] text-wiki-link transition-colors hover:bg-wiki-link/20 hover:underline"
						>
							{cat.name}
						</a>
					))}
				</div>
			)}

			{/* Footer */}
			<WikiFooter
				lastEdited={page.updatedAt}
				lastEditor={page.lastEditorId || undefined}
				viewCount={page.viewCount}
				slug={slug}
			/>
		</div>
	)
}

/** Extract plain text from React children */
function extractText(children: React.ReactNode): string {
	if (typeof children === 'string') return children
	if (typeof children === 'number') return String(children)
	if (Array.isArray(children)) return children.map(extractText).join('')
	if (children && typeof children === 'object' && 'props' in children) {
		return extractText(
			(children as React.ReactElement<{ children?: React.ReactNode }>).props.children,
		)
	}
	return ''
}
