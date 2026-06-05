'use client'

import { wikiApi } from '@/api/wiki'
import type { WikiTag } from '@briar/shared'
import { Loader2, Tag } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface WikiTagPageProps {
	slug: string
}

export default function WikiTagPage({ slug }: WikiTagPageProps) {
	const [tag, setTag] = useState<WikiTag | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchTag = useCallback(async () => {
		setLoading(true)
		try {
			const res = await wikiApi.getTag(slug)
			if (res.success && res.data) {
				setTag(res.data)
			} else {
				setError(res.message || '标签未找到')
			}
		} catch {
			setError('加载标签时发生错误')
		} finally {
			setLoading(false)
		}
	}, [slug])

	useEffect(() => {
		fetchTag()
	}, [fetchTag])

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-8 w-8 animate-spin text-wiki-text-muted" />
				<span className="ml-2 text-wiki-text-muted">加载中...</span>
			</div>
		)
	}

	if (error || !tag) {
		return (
			<div className="rounded-sm border border-wiki-highlight bg-wiki-highlight px-4 py-3 text-[13px] text-wiki-link-red">
				{error || '标签未找到'}
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<Tag className="h-5 w-5" style={{ color: tag.color }} />
				<h1 className="text-[1.5em] font-normal text-wiki-text">{tag.name}</h1>
			</div>

			<p className="text-[13px] text-wiki-text-secondary">关联文章数：{tag.pageCount}</p>

			<div className="rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-6 text-center text-[13px] text-wiki-text-muted">
				标签页面内容待实现（需要后端支持按标签查询文章）
			</div>
		</div>
	)
}
