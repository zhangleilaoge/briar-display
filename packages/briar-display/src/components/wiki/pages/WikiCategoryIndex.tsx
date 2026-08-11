'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import { WikiButton as Button } from '@/components/wiki/common/ui/button'
import { WikiInput as Input } from '@/components/wiki/common/ui/input'
import { cn } from '@/lib/utils'
import type { WikiCategory, WikiCategoryTreeNode } from '@briar/shared'
import {
	ChevronDown,
	ChevronRight,
	FolderTree,
	Loader2,
	Pencil,
	Plus,
	Trash2,
	X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface EditingState {
	slug: string
	name: string
	description: string
}

function CategoryTreeNode({
	node,
	depth = 0,
	defaultExpanded,
	allCategories,
	onRefresh,
}: {
	node: WikiCategoryTreeNode
	depth?: number
	defaultExpanded: boolean
	allCategories: WikiCategoryTreeNode[]
	onRefresh: () => void
}) {
	const hasChildren = node.children.length > 0
	const [expanded, setExpanded] = useState(defaultExpanded)
	const [editing, setEditing] = useState<EditingState | null>(null)
	const [saving, setSaving] = useState(false)

	const handleUpdate = async () => {
		if (!editing) return
		setSaving(true)
		const res = await wikiApi.updateCategory(editing.slug, {
			name: editing.name.trim(),
			description: editing.description.trim() || undefined,
		})
		setSaving(false)
		if (res.success) {
			setEditing(null)
			onRefresh()
		} else {
			alert(res.message || '更新失败')
		}
	}

	const handleDelete = async () => {
		if (!confirm(`确定删除分类「${node.name}」？`)) return
		const res = await wikiApi.deleteCategory(node.slug)
		if (res.success) {
			onRefresh()
		} else {
			alert(res.message || '删除失败')
		}
	}

	return (
		<div>
			<div
				className={cn(
					'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted',
				)}
				style={{ paddingLeft: `${depth * 24 + 8}px` }}
			>
				{hasChildren ? (
					<button
						type="button"
						onClick={() => setExpanded(!expanded)}
						className="flex-shrink-0 rounded p-0.5 transition-colors hover:bg-muted-foreground/10"
						aria-label={expanded ? '折叠' : '展开'}
					>
						{expanded ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
					</button>
				) : (
					<span className="w-6" />
				)}

				{editing ? (
					<div className="flex flex-1 items-center gap-2">
						<Input
							value={editing.name}
							onChange={(e) => setEditing({ ...editing, name: e.target.value })}
							placeholder="分类名称"
							className="h-7"
						/>
						<Input
							value={editing.description}
							onChange={(e) => setEditing({ ...editing, description: e.target.value })}
							placeholder="描述（可选）"
							className="h-7"
						/>
						<Button
							type="button"
							size="sm"
							onClick={handleUpdate}
							disabled={saving || !editing.name.trim()}
						>
							{saving ? '保存中...' : '保存'}
						</Button>
						<Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
							<X className="h-3.5 w-3.5" />
						</Button>
					</div>
				) : (
					<>
						<a
							href={`/briar/wiki/category/${node.slug}`}
							className="flex flex-1 items-center gap-2 text-foreground transition-colors hover:text-primary"
						>
							<FolderTree className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
							<span className="font-medium">{node.name}</span>
							{node.pageCount > 0 && (
								<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
									{node.pageCount} 页
								</span>
							)}
						</a>
						<div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() =>
									setEditing({
										slug: node.slug,
										name: node.name,
										description: node.description || '',
									})
								}
								title="编辑"
							>
								<Pencil className="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={handleDelete}
								className="text-wiki-link-red hover:bg-wiki-highlight"
								title="删除"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</Button>
						</div>
					</>
				)}
			</div>

			{hasChildren && expanded && (
				<div>
					{node.children.map((child) => (
						<CategoryTreeNode
							key={child.id}
							node={child}
							depth={depth + 1}
							defaultExpanded={false}
							allCategories={allCategories}
							onRefresh={onRefresh}
						/>
					))}
				</div>
			)}
		</div>
	)
}

function flattenTree(nodes: WikiCategoryTreeNode[]): WikiCategoryTreeNode[] {
	const result: WikiCategoryTreeNode[] = []
	for (const node of nodes) {
		result.push(node)
		if (node.children.length > 0) {
			result.push(...flattenTree(node.children))
		}
	}
	return result
}

export default function WikiCategoryIndex() {
	const [tree, setTree] = useState<WikiCategoryTreeNode[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showCreate, setShowCreate] = useState(false)
	const [newName, setNewName] = useState('')
	const [newDescription, setNewDescription] = useState('')
	const [newParentId, setNewParentId] = useState('')
	const [creating, setCreating] = useState(false)

	const fetchTree = useCallback(async () => {
		setLoading(true)
		const res = await wikiApi.getCategoryTree()
		if (res.success && res.data) {
			setTree(res.data)
			setError(null)
		} else {
			setError(res.message || '加载分类失败')
		}
		setLoading(false)
	}, [])

	useEffect(() => {
		fetchTree()
	}, [fetchTree])

	const handleCreate = async () => {
		if (!newName.trim()) return
		setCreating(true)
		const res = await wikiApi.createCategory({
			name: newName.trim(),
			description: newDescription.trim() || undefined,
			parentId: newParentId || undefined,
		})
		setCreating(false)
		if (res.success) {
			setNewName('')
			setNewDescription('')
			setNewParentId('')
			setShowCreate(false)
			fetchTree()
		} else {
			alert(res.message || '创建失败')
		}
	}

	const allCategories = flattenTree(tree)

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '分类' }]} />

			<div className="flex items-center justify-between">
				<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
					<FolderTree className="h-5 w-5" />
					分类浏览
				</h2>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setShowCreate(!showCreate)}
				>
					{showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
					{showCreate ? '取消' : '新建分类'}
				</Button>
			</div>

			{showCreate && (
				<div className="rounded-md border border-border bg-white p-4">
					<h3 className="mb-3 font-medium text-sm">新建分类</h3>
					<div className="space-y-3">
						<div>
							<label className="mb-1 block text-muted-foreground text-xs">名称 *</label>
							<Input
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="分类名称"
							/>
						</div>
						<div>
							<label className="mb-1 block text-muted-foreground text-xs">描述</label>
							<Input
								value={newDescription}
								onChange={(e) => setNewDescription(e.target.value)}
								placeholder="可选描述"
							/>
						</div>
						{allCategories.length > 0 && (
							<div>
								<label className="mb-1 block text-muted-foreground text-xs">父分类</label>
								<select
									value={newParentId}
									onChange={(e) => setNewParentId(e.target.value)}
									className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
								>
									<option value="">无（顶级分类）</option>
									{allCategories.map((cat) => (
										<option key={cat.id} value={cat.id}>
											{cat.name}
										</option>
									))}
								</select>
							</div>
						)}
						<Button
							type="button"
							size="sm"
							onClick={handleCreate}
							disabled={creating || !newName.trim()}
						>
							{creating ? '创建中...' : '创建'}
						</Button>
					</div>
				</div>
			)}

			{loading ? (
				<div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" />
					加载中...
				</div>
			) : error ? (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
					{error}
				</div>
			) : tree.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<FolderTree className="h-10 w-10 opacity-30" />
					<p className="text-sm">暂无分类</p>
				</div>
			) : (
				<div className="rounded-md border border-border bg-white">
					<div className="divide-y divide-border/30">
						{tree.map((node) => (
							<CategoryTreeNode
								key={node.id}
								node={node}
								defaultExpanded={true}
								allCategories={allCategories}
								onRefresh={fetchTree}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
