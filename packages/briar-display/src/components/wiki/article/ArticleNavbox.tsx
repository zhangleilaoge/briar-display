'use client'

import { wikiApi } from '@/api/wiki'
import type {
	WikiCategory,
	WikiCategoryTreeNode,
	WikiPageSummary,
	WikiPaginatedResponse,
} from '@briar/shared'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ArticleNavboxProps {
	categorySlug: string
}

interface CategoryData extends WikiCategory {
	pages: WikiPaginatedResponse<WikiPageSummary>
	subcategories: WikiCategoryTreeNode[]
}

export default function ArticleNavbox({ categorySlug }: ArticleNavboxProps) {
	const [data, setData] = useState<CategoryData | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let cancelled = false
		wikiApi.getCategory(categorySlug, 20, 0).then((res) => {
			if (!cancelled && res.success && res.data) {
				setData(res.data as CategoryData)
			}
			if (!cancelled) setLoading(false)
		})
		return () => {
			cancelled = true
		}
	}, [categorySlug])

	if (loading) {
		return (
			<div className="flex items-center justify-center py-4">
				<Loader2 className="h-4 w-4 animate-spin text-wiki-text-muted" />
			</div>
		)
	}

	if (!data) return null

	const pages = data.pages?.items || []

	return (
		<div className="overflow-hidden rounded-sm border border-wiki-border-light">
			<div className="border-b border-wiki-border-light bg-wiki-bg-tertiary px-4 py-2">
				<span className="text-[13px] font-medium text-wiki-text">📂 {data.name}</span>
				{data.description && (
					<span className="ml-2 text-[12px] text-wiki-text-muted">— {data.description}</span>
				)}
			</div>
			<div className="grid grid-cols-2 gap-px bg-wiki-border-light p-px sm:grid-cols-3">
				{pages.map((page) => (
					<a
						key={page.id}
						href={`/briar-display/wiki/${page.slug}`}
						className="flex items-center gap-2 bg-wiki-bg px-3 py-2 text-[12px] text-wiki-link transition-colors hover:bg-wiki-bg-secondary"
					>
						<span className="truncate">{page.title}</span>
					</a>
				))}
			</div>
		</div>
	)
}
