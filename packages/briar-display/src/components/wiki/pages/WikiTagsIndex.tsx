'use client'

import { wikiApi } from '@/api/wiki'
import type { WikiTag } from '@briar/shared'
import { Loader2, Tag } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export default function WikiTagsIndex() {
	const [tags, setTags] = useState<WikiTag[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchTags = useCallback(async () => {
		setLoading(true)
		try {
			const res = await wikiApi.getTags()
			if (res.success && res.data) {
				setTags(res.data)
			} else {
				setError(res.message || '加载标签失败')
			}
		} catch {
			setError('加载标签时发生错误')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchTags()
	}, [fetchTags])

	if (loading) {
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

	const maxCount = Math.max(...tags.map((t) => t.pageCount), 1)

	return (
		<div className="space-y-5">
			<h1 className="border-b border-wiki-border-light pb-2 text-[1.5em] font-normal text-wiki-text">
				标签
			</h1>

			{tags.length === 0 ? (
				<div className="py-12 text-center text-[13px] text-wiki-text-muted">暂无标签</div>
			) : (
				<div className="flex flex-wrap gap-3">
					{tags.map((tag) => {
						const size = 12 + (tag.pageCount / maxCount) * 8
						return (
							<a
								key={tag.id}
								href={`/briar-display/wiki/tag/${tag.slug}`}
								className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white transition-all hover:opacity-80 hover:shadow-sm"
								style={{
									backgroundColor: tag.color,
									fontSize: `${size}px`,
								}}
							>
								<Tag className="h-3 w-3" />
								{tag.name}
								{tag.pageCount > 0 && (
									<span className="ml-0.5 text-[10px] opacity-70">({tag.pageCount})</span>
								)}
							</a>
						)
					})}
				</div>
			)}
		</div>
	)
}
