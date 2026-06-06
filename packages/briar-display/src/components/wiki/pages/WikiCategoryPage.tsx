'use client'

import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiLink from '@/components/wiki/common/WikiLink'
import { cn } from '@/lib/utils'
import type { WikiCategory, WikiCategoryTreeNode, WikiPageSummary } from '@briar/shared'
import {
	Calendar,
	FileText,
	FolderOpen,
	FolderTree,
	Loader2,
	Pencil,
	Trash2,
	X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface WikiCategoryPageProps {
	slug: string
}

function formatDate(date: Date | string) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
}

export default function WikiCategoryPage({ slug }: WikiCategoryPageProps) {
	const [category, setCategory] = useState<WikiCategory | null>(null)
	const [subcategories, setSubcategories] = useState<WikiCategoryTreeNode[]>([])
	const [pages, setPages] = useState<WikiPageSummary[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [editing, setEditing] = useState(false)
	const [editName, setEditName] = useState('')
	const [editDescription, setEditDescription] = useState('')
	const [saving, setSaving] = useState(false)

	const loadData = useCallback(async () => {
		setLoading(true)
		setError(null)

		const res = await wikiApi.getCategory(slug)
		if (res.success && res.data) {
			setCategory(res.data)
			const data = res.data as WikiCategory & {
				pages?: WikiPageSummary[]
				subcategories?: WikiCategoryTreeNode[]
			}
			setPages(data.pages ?? [])
			setSubcategories(data.subcategories ?? [])
		} else {
			setError(res.message || '加载分类失败')
		}
		setLoading(false)
	}, [slug])

	useEffect(() => {
		loadData()
	}, [loadData])

	const startEdit = () => {
		if (!category) return
		setEditName(category.name)
		setEditDescription(category.description || '')
		setEditing(true)
	}

	const handleSave = async () => {
		if (!editName.trim()) return
		setSaving(true)
		const res = await wikiApi.updateCategory(slug, {
			name: editName.trim(),
			description: editDescription.trim() || undefined,
		})
		setSaving(false)
		if (res.success) {
			setEditing(false)
			loadData()
		} else {
			alert(res.message || '更新失败')
		}
	}

	const handleDelete = async () => {
		if (!category || !confirm(`确定删除分类「${category.name}」？`)) return
		const res = await wikiApi.deleteCategory(slug)
		if (res.success) {
			window.location.href = '/briar-display/wiki/category'
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

	if (error || !category) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: '分类' }, { label: '错误' }]} />
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
					{error || '分类不存在'}
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs
				items={[{ label: '分类', href: '/briar-display/wiki/category/' }, { label: category.name }]}
			/>

			<div>
				<div className="flex items-center justify-between">
					<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
						<FolderTree className="h-5 w-5" />
						{category.name}
					</h2>
					<div className="flex items-center gap-1">
						<Button type="button" variant="ghost" size="sm" onClick={startEdit}>
							<Pencil className="h-3.5 w-3.5" />
							编辑
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleDelete}
							className="text-wiki-link-red hover:bg-wiki-highlight"
						>
							<Trash2 className="h-3.5 w-3.5" />
							删除
						</Button>
					</div>
				</div>

				{editing ? (
					<div className="mt-3 rounded-md border border-border bg-white p-4">
						<div className="space-y-3">
							<div>
								<label className="mb-1 block text-muted-foreground text-xs">名称</label>
								<Input value={editName} onChange={(e) => setEditName(e.target.value)} />
							</div>
							<div>
								<label className="mb-1 block text-muted-foreground text-xs">描述</label>
								<Input
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
									placeholder="可选描述"
								/>
							</div>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									size="sm"
									onClick={handleSave}
									disabled={saving || !editName.trim()}
								>
									{saving ? '保存中...' : '保存'}
								</Button>
								<Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
									取消
								</Button>
							</div>
						</div>
					</div>
				) : (
					<>
						{category.description && (
							<p className="mt-1 text-muted-foreground text-sm">{category.description}</p>
						)}
						<div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
							<span className="inline-flex items-center gap-1">
								<FileText className="h-3 w-3" />
								{category.pageCount} 篇文章
							</span>
							<span className="inline-flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								创建于 {formatDate(category.createdAt)}
							</span>
						</div>
					</>
				)}
			</div>

			{/* Subcategories */}
			{subcategories.length > 0 && (
				<div className="space-y-2">
					<h3 className="flex items-center gap-1.5 font-medium text-sm">
						<FolderOpen className="h-4 w-4 text-muted-foreground" />
						子分类
					</h3>
					<div className="flex flex-wrap gap-2">
						{subcategories.map((sub) => (
							<a
								key={sub.id}
								href={`/briar-display/wiki/category/${sub.slug}`}
								className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm transition-colors hover:bg-muted"
							>
								<FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
								{sub.name}
								{sub.pageCount > 0 && (
									<span className="text-muted-foreground text-xs">({sub.pageCount})</span>
								)}
							</a>
						))}
					</div>
				</div>
			)}

			{/* Pages list */}
			<div className="space-y-2">
				<h3 className="font-medium text-sm">分类下的文章</h3>

				{pages.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
						<FileText className="h-8 w-8 opacity-30" />
						<p className="text-sm">该分类下暂无文章</p>
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
									<th className="hidden px-4 py-2 text-right font-medium text-muted-foreground md:table-cell">
										浏览量
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/50">
								{pages.map((page) => (
									<tr key={page.id} className="transition-colors hover:bg-muted/30">
										<td className="px-4 py-2">
											<WikiLink slug={page.slug} title={page.title} />
											{page.status === 'draft' && (
												<span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 text-xs">
													草稿
												</span>
											)}
										</td>
										<td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">
											{formatDate(page.updatedAt)}
										</td>
										<td className="hidden px-4 py-2 text-right text-muted-foreground md:table-cell">
											{page.viewCount.toLocaleString()}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	)
}
