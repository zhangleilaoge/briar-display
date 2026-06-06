'use client'

import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import { cn } from '@/lib/utils'
import type { WikiSearchResult } from '@briar/shared'
import { Hash, Loader2, Search, SearchX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const NAMESPACE_LABELS: Record<string, string> = {
	main: '文章',
	talk: '讨论',
	user: '用户',
	template: '模板',
	category: '分类',
}

const NAMESPACE_COLORS: Record<string, string> = {
	main: 'bg-blue-100 text-blue-700',
	talk: 'bg-purple-100 text-purple-700',
	user: 'bg-green-100 text-green-700',
	template: 'bg-amber-100 text-amber-700',
	category: 'bg-pink-100 text-pink-700',
}

const PAGE_SIZE = 20

/** Highlight matching keywords in text */
function HighlightedText({ text, query }: { text: string; query: string }) {
	if (!query.trim()) return <span>{text}</span>

	const keywords = query
		.trim()
		.split(/\s+/)
		.filter((k) => k.length > 0)
	if (keywords.length === 0) return <span>{text}</span>

	const pattern = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
	const regex = new RegExp(`(${pattern})`, 'gi')
	const parts = text.split(regex)

	return (
		<span>
			{parts.map((part, i) => {
				const isMatch = keywords.some((k) => part.toLowerCase() === k.toLowerCase())
				return isMatch ? (
					<mark key={i} className="rounded-sm bg-wiki-highlight px-0.5 text-wiki-text">
						{part}
					</mark>
				) : (
					<span key={i}>{part}</span>
				)
			})}
		</span>
	)
}

export default function WikiSearchResults() {
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<WikiSearchResult[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [searched, setSearched] = useState(false)

	const performSearch = useCallback(async (q: string, newOffset: number) => {
		if (!q.trim()) return

		setLoading(true)
		setError(null)
		try {
			const res = await wikiApi.search(q.trim(), PAGE_SIZE, newOffset)
			if (res.success && res.data) {
				setResults(res.data.items)
				setTotal(res.data.total)
				setOffset(newOffset)
			} else {
				setError(res.message || '搜索失败')
				setResults([])
				setTotal(0)
			}
		} catch {
			setError('搜索时发生错误')
			setResults([])
			setTotal(0)
		} finally {
			setLoading(false)
			setSearched(true)
		}
	}, [])

	// Read q from URL on mount
	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const q = params.get('q') || ''
		setQuery(q)
		if (q.trim()) {
			performSearch(q, 0)
		}
	}, [performSearch])

	const handleSearch = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (query.trim()) {
				window.history.pushState(
					{},
					'',
					`/briar-display/wiki/search?q=${encodeURIComponent(query.trim())}`,
				)
				window.dispatchEvent(new PopStateEvent('popstate'))
				performSearch(query, 0)
			}
		},
		[query, performSearch],
	)

	const handlePageChange = useCallback(
		(newOffset: number) => {
			performSearch(query, newOffset)
			window.scrollTo({ top: 0, behavior: 'smooth' })
		},
		[query, performSearch],
	)

	return (
		<div className="space-y-5">
			<h1 className="border-b border-wiki-border-light pb-2 text-[1.5em] font-normal text-wiki-text">
				搜索
			</h1>

			{/* Search form */}
			<form onSubmit={handleSearch} className="flex gap-2">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wiki-text-muted" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="搜索文章标题和内容..."
						className="pl-10"
					/>
				</div>
				<Button type="submit" disabled={loading}>
					{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索'}
				</Button>
			</form>

			{/* Error */}
			{error && (
				<div className="rounded-sm border border-wiki-highlight bg-wiki-highlight px-4 py-3 text-[13px] text-wiki-link-red">
					{error}
				</div>
			)}

			{/* Loading */}
			{loading && (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-wiki-text-muted" />
					<span className="ml-2 text-[13px] text-wiki-text-muted">搜索中...</span>
				</div>
			)}

			{/* Results */}
			{!loading &&
				searched &&
				(results.length > 0 ? (
					<>
						<p className="text-[13px] text-wiki-text-secondary">
							共找到 <span className="font-medium text-wiki-text">{total}</span> 条结果
						</p>

						<ul className="divide-y divide-wiki-border-light rounded-sm border border-wiki-border-light bg-wiki-bg">
							{results.map((result) => (
								<li key={result.id}>
									<a
										href={`/briar-display/wiki/${result.slug}`}
										className="block px-5 py-4 transition-colors hover:bg-wiki-bg-secondary"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<h3 className="truncate text-[15px] font-medium text-wiki-link hover:underline">
														<HighlightedText text={result.title} query={query} />
													</h3>
													<span
														className={cn(
															'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
															NAMESPACE_COLORS[result.namespace] || NAMESPACE_COLORS.main,
														)}
													>
														{NAMESPACE_LABELS[result.namespace] || result.namespace}
													</span>
												</div>

												{result.summary && (
													<p className="mt-1 line-clamp-2 text-[13px] leading-[1.6] text-wiki-text-secondary">
														<HighlightedText text={result.summary} query={query} />
													</p>
												)}

												{result.highlight && (
													<p
														className="mt-1.5 line-clamp-2 text-[12px] leading-[1.6] text-wiki-text-muted"
														// biome-ignore lint/security/noDangerouslySetInnerHtml: highlight from server
														dangerouslySetInnerHTML={{
															__html: result.highlight,
														}}
													/>
												)}
											</div>

											<div className="shrink-0 text-right">
												<div className="flex items-center gap-1 text-[12px] text-wiki-text-muted">
													<Hash className="h-3 w-3" />
													<span>{result.relevance.toFixed(1)}</span>
												</div>
											</div>
										</div>
									</a>
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
				) : (
					<div className="flex flex-col items-center justify-center py-16 text-center">
						<SearchX className="mb-4 h-12 w-12 text-wiki-text-muted/50" />
						<h3 className="mb-1 text-[15px] font-medium text-wiki-text">未找到结果</h3>
						<p className="text-[13px] text-wiki-text-secondary">
							没有找到与「{query}」相关的文章，请尝试其他关键词。
						</p>
					</div>
				))}

			{/* Initial state */}
			{!loading && !searched && !error && (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<Search className="mb-4 h-12 w-12 text-wiki-text-muted/30" />
					<h3 className="mb-1 text-[15px] font-medium text-wiki-text">搜索 Wiki</h3>
					<p className="text-[13px] text-wiki-text-secondary">输入关键词搜索文章标题和内容。</p>
				</div>
			)}
		</div>
	)
}
