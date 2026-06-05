'use client'

import { wikiApi } from '@/api/wiki'
import type { WikiTag } from '@briar/shared'
import { Calendar, FileText, Loader2, Tag, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface WikiTagPageProps {
	slug: string
}

interface TagPage {
	id: string
	title: string
	slug: string
	namespace: string
	summary: string | null
	updatedAt: string
}

export default function WikiTagPage({ slug }: WikiTagPageProps) {
	const [tag, setTag] = useState<WikiTag | null>(null)
	const [pages, setPages] = useState<TagPage[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchData = useCallback(async () => {
		setLoading(true)
		try {
			const res = await wikiApi.getTagPages(slug)
			if (res.success && res.data) {
				setTag(res.data.tag)
				setPages(res.data.pages)
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
		fetchData()
	}, [fetchData])

	const handleDelete = async () => {
		if (!tag || !confirm(`确定删除标签「${tag.name}」？`)) return
		const res = await wikiApi.deleteTag(tag.id)
		if (res.success) {
			window.location.href = '/briar-display/wiki/special/tags'
		} else {
			alert(res.message || '删除失败')
		}
	}

	const formatDate = (dateStr: string) => {
		try {
			const date = new Date(dateStr)
			return date.toLocaleDateString('zh-CN', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			})
		} catch {
			return dateStr
		}
	}

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
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Tag className="h-5 w-5" style={{ color: tag.color }} />
					<h1 className="text-[1.5em] font-normal text-wiki-text">{tag.name}</h1>
				</div>
				<button
					type="button"
					onClick={handleDelete}
					className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-red-100 hover:text-red-600"
				>
					<Trash2 className="h-3.5 w-3.5" />
					删除标签
				</button>
			</div>

			<p className="text-[13px] text-wiki-text-secondary">共 {tag.pageCount} 篇文章使用此标签</p>

			{pages.length === 0 ? (
				<div className="rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-6 text-center text-[13px] text-wiki-text-muted">
					暂无使用此标签的文章
				</div>
			) : (
				<div className="space-y-3">
					{pages.map((page) => (
						<a
							key={page.id}
							href={`/briar-display/wiki/${page.namespace}/${page.slug}`}
							className="block rounded-sm border border-wiki-border-light bg-wiki-bg p-4 transition-colors hover:border-wiki-link hover:bg-wiki-bg-secondary"
						>
							<div className="flex items-start gap-3">
								<FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-wiki-text-muted" />
								<div className="min-w-0 flex-1">
									<h3 className="text-[14px] font-medium text-wiki-link">{page.title}</h3>
									{page.summary && (
										<p className="mt-1 line-clamp-2 text-[13px] text-wiki-text-secondary">
											{page.summary}
										</p>
									)}
									<div className="mt-2 flex items-center gap-4 text-[12px] text-wiki-text-muted">
										<span className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											{formatDate(page.updatedAt)}
										</span>
										{page.namespace !== 'main' && (
											<span className="rounded bg-wiki-bg-secondary px-1.5 py-0.5 text-[11px]">
												{page.namespace}
											</span>
										)}
									</div>
								</div>
							</div>
						</a>
					))}
				</div>
			)}
		</div>
	)
}
