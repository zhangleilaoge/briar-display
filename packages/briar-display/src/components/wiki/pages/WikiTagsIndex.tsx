'use client'

import { wikiApi } from '@/api/wiki'
import { Badge } from '@/components/ui/badge'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import { WikiButton as Button } from '@/components/wiki/common/ui/button'
import { WikiInput as Input } from '@/components/wiki/common/ui/input'
import { usePermissions } from '@/contexts/PermissionContext'
import { PERMISSIONS, type WikiTag } from '@briar/shared'
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
	const { hasPermission, isAdmin } = usePermissions()
	const canManageTags = isAdmin || hasPermission(PERMISSIONS.WIKI_TAG_CREATE)

	const fetchTags = useCallback(async () => {
		setLoading(true)
		try {
			const res = await wikiApi.getTags()
			if (res.success && res.data) {
				setTags(res.data.items)
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
				setError(res.message || '创建失败')
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
			setError(res.message || '删除失败')
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-6 w-6 animate-spin text-wiki-text-muted" />
			</div>
		)
	}

	return (
		<div className="space-y-5">
			<WikiBreadcrumbs items={[{ label: '标签' }]} />

			<div className="flex items-center justify-between border-b border-wiki-border-light pb-2">
				<h1 className="text-[1.5em] font-normal text-wiki-text">标签</h1>
				{canManageTags && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setShowCreate(!showCreate)}
					>
						{showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
						{showCreate ? '取消' : '新建标签'}
					</Button>
				)}
			</div>

			{error && (
				<div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
					{error}
					<button type="button" onClick={() => setError(null)} className="ml-auto">
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			{showCreate && (
				<div className="rounded border border-wiki-border-light bg-wiki-bg-secondary p-4 space-y-3">
					<h3 className="text-[13px] font-medium text-wiki-text">新建标签</h3>
					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<label className="mb-1 block text-[12px] text-wiki-text-muted">名称</label>
							<Input
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="标签名称"
								className="h-8 text-[13px]"
							/>
						</div>
						<div>
							<label className="mb-1 block text-[12px] text-wiki-text-muted">颜色</label>
							<div className="flex flex-wrap items-center gap-1.5">
								{COLOR_PRESETS.map((color) => (
									<button
										key={color}
										type="button"
										onClick={() => setNewColor(color)}
										className={`h-6 w-6 rounded-full transition-all ${
											newColor === color ? 'ring-2 ring-wiki-link ring-offset-1' : 'hover:scale-110'
										}`}
										style={{ backgroundColor: color }}
									/>
								))}
								<input
									type="color"
									value={newColor}
									onChange={(e) => setNewColor(e.target.value)}
									className="h-6 w-6 cursor-pointer rounded border-0"
									title="自定义颜色"
								/>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Button
							type="button"
							size="sm"
							onClick={handleCreate}
							disabled={creating || !newName.trim()}
							className="h-7 text-xs"
						>
							{creating ? '创建中...' : '创建'}
						</Button>
						<span className="text-[12px] text-wiki-text-muted">预览：</span>
						<Badge className="text-white" style={{ backgroundColor: newColor }}>
							{newName || '标签名'}
						</Badge>
					</div>
				</div>
			)}

			{tags.length === 0 ? (
				<div className="py-12 text-center text-[13px] text-wiki-text-muted">暂无标签</div>
			) : (
				<div className="flex flex-wrap gap-2">
					{tags.map((tag) => (
						<a
							key={tag.id}
							href={`/briar-display/wiki/tag/${tag.slug}`}
							className="group relative inline-flex items-center"
						>
							<Badge
								className="cursor-pointer text-white transition-all hover:opacity-80 hover:shadow-sm"
								style={{ backgroundColor: tag.color }}
							>
								<Tag className="mr-1 h-3 w-3" />
								{tag.name}
								{tag.pageCount > 0 && <span className="ml-1 opacity-70">{tag.pageCount}</span>}
							</Badge>
							{canManageTags && (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault()
										handleDelete(tag)
									}}
									className="-right-1 -top-1 absolute flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
									title={`删除标签「${tag.name}」`}
								>
									<X className="h-2.5 w-2.5" />
								</button>
							)}
						</a>
					))}
				</div>
			)}
		</div>
	)
}
