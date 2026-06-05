'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import type { WikiTag } from '@briar/shared'
import { Loader2, Plus, Tag, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const COLOR_PRESETS = [
	'#3b82f6',
	'#ef4444',
	'#10b981',
	'#f59e0b',
	'#8b5cf6',
	'#ec4899',
	'#06b6d4',
	'#f97316',
	'#6366f1',
	'#14b8a6',
	'#e11d48',
	'#84cc16',
]

export default function WikiTagsIndex() {
	const [tags, setTags] = useState<WikiTag[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showCreate, setShowCreate] = useState(false)
	const [newName, setNewName] = useState('')
	const [newColor, setNewColor] = useState(COLOR_PRESETS[0])
	const [creating, setCreating] = useState(false)

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

	const handleCreate = async () => {
		if (!newName.trim()) return
		setCreating(true)
		try {
			const res = await wikiApi.createTag({ name: newName.trim(), color: newColor })
			if (res.success) {
				setNewName('')
				setShowCreate(false)
				fetchTags()
			} else {
				alert(res.message || '创建失败')
			}
		} finally {
			setCreating(false)
		}
	}

	const handleDelete = async (tag: WikiTag) => {
		if (!confirm(`确定删除标签「${tag.name}」？`)) return
		const res = await wikiApi.deleteTag(tag.id)
		if (res.success) {
			fetchTags()
		} else {
			alert(res.message || '删除失败')
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
			<WikiBreadcrumbs items={[{ label: '标签' }]} />

			<div className="flex items-center justify-between border-b border-wiki-border-light pb-2">
				<h1 className="text-[1.5em] font-normal text-wiki-text">标签</h1>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
				>
					{showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
					{showCreate ? '取消' : '新建标签'}
				</button>
			</div>

			{showCreate && (
				<div className="rounded-md border border-border bg-white p-4">
					<h3 className="mb-3 font-medium text-sm">新建标签</h3>
					<div className="space-y-3">
						<div>
							<label className="mb-1 block text-muted-foreground text-xs">名称 *</label>
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
								placeholder="标签名称"
							/>
						</div>
						<div>
							<label className="mb-1 block text-muted-foreground text-xs">颜色</label>
							<div className="flex flex-wrap items-center gap-2">
								{COLOR_PRESETS.map((color) => (
									<button
										key={color}
										type="button"
										onClick={() => setNewColor(color)}
										className={`h-7 w-7 rounded-full transition-all ${
											newColor === color ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-110'
										}`}
										style={{ backgroundColor: color }}
									/>
								))}
								<input
									type="color"
									value={newColor}
									onChange={(e) => setNewColor(e.target.value)}
									className="h-7 w-7 cursor-pointer rounded border-0"
									title="自定义颜色"
								/>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleCreate}
								disabled={creating || !newName.trim()}
								className="rounded bg-primary px-4 py-1.5 text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
							>
								{creating ? '创建中...' : '创建'}
							</button>
							<span className="text-muted-foreground text-xs">预览：</span>
							<span
								className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm text-white"
								style={{ backgroundColor: newColor }}
							>
								<Tag className="h-3 w-3" />
								{newName || '标签名'}
							</span>
						</div>
					</div>
				</div>
			)}

			{tags.length === 0 ? (
				<div className="py-12 text-center text-[13px] text-wiki-text-muted">暂无标签</div>
			) : (
				<div className="flex flex-wrap gap-3">
					{tags.map((tag) => {
						const size = 12 + (tag.pageCount / maxCount) * 8
						return (
							<span key={tag.id} className="group relative inline-flex items-center">
								<a
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
								<button
									type="button"
									onClick={() => handleDelete(tag)}
									className="-right-1.5 -top-1.5 absolute flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
									title={`删除标签「${tag.name}」`}
								>
									<X className="h-3 w-3" />
								</button>
							</span>
						)
					})}
				</div>
			)}
		</div>
	)
}
