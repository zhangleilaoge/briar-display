'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiLink from '@/components/wiki/common/WikiLink'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import type { WikiTag } from '@briar/shared'
import { Calendar, Loader2, Pencil, Tag, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 20

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

function formatDate(dateStr: string) {
	try {
		const d = new Date(dateStr)
		return d.toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		})
	} catch {
		return dateStr
	}
}

export default function WikiTagPage({ slug }: WikiTagPageProps) {
	const [tag, setTag] = useState<WikiTag | null>(null)
	const [pages, setPages] = useState<TagPage[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const fetchData = useCallback(async () => {
		setLoading(true)
		try {
			const res = await wikiApi.getTagPages(slug, { limit: PAGE_SIZE, offset })
			if (res.success && res.data) {
				setTag(res.data.tag)
				setPages(res.data.pages)
				setTotal(res.data.total)
			} else {
				setError(res.message || '标签未找到')
			}
		} catch {
			setError('加载标签时发生错误')
		} finally {
			setLoading(false)
		}
	}, [slug, offset])

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

	if (loading) {
		return (
			<div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
				<Loader2 className="h-5 w-5 animate-spin" />
				加载中...
			</div>
		)
	}

	if (error || !tag) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: '标签' }, { label: '错误' }]} />
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
					{error || '标签不存在'}
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs
				items={[{ label: '标签', href: '/briar-display/wiki/special/tags' }, { label: tag.name }]}
			/>

			<div>
				<div className="flex items-center justify-between">
					<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
						<span
							className="inline-block h-3 w-3 rounded-full"
							style={{ backgroundColor: tag.color }}
						/>
						{tag.name}
					</h2>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={handleDelete}
							className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-red-100 hover:text-red-600"
						>
							<Trash2 className="h-3.5 w-3.5" />
							删除
						</button>
					</div>
				</div>

				<div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
					<span className="inline-flex items-center gap-1">
						<Tag className="h-3 w-3" />
						{tag.pageCount} 篇文章
					</span>
					<span className="inline-flex items-center gap-1">
						<Calendar className="h-3 w-3" />
						创建于 {formatDate(tag.createdAt)}
					</span>
				</div>
			</div>

			<div className="space-y-2">
				<h3 className="font-medium text-sm">标签下的文章</h3>

				{pages.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
						<Tag className="h-8 w-8 opacity-30" />
						<p className="text-sm">暂无使用此标签的文章</p>
					</div>
				) : (
					<div className="rounded-md border border-border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border bg-muted/50">
									<th className="px-4 py-2 text-left font-medium text-muted-foreground">
										文章标题
									</th>
									<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
										最后编辑
									</th>
									<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground md:table-cell">
										摘要
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/50">
								{pages.map((page) => (
									<tr key={page.id} className="transition-colors hover:bg-muted/30">
										<td className="px-4 py-2">
											<WikiLink slug={page.slug} title={page.title} namespace={page.namespace} />
											{page.namespace !== 'main' && (
												<span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
													{page.namespace}
												</span>
											)}
										</td>
										<td className="hidden whitespace-nowrap px-4 py-2 text-muted-foreground sm:table-cell">
											{formatDate(page.updatedAt)}
										</td>
										<td className="hidden max-w-xs truncate px-4 py-2 text-muted-foreground md:table-cell">
											{page.summary || '—'}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<WikiPagination total={total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
			</div>
		</div>
	)
}
