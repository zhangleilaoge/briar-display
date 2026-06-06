'use client'

import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { WikiCategoryTreeNode } from '@briar/shared'
import { ChevronDown, ChevronRight, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CategorySelectorProps {
	selected: string[]
	onChange: (ids: string[]) => void
}

export default function CategorySelector({ selected, onChange }: CategorySelectorProps) {
	const [tree, setTree] = useState<WikiCategoryTreeNode[]>([])
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [loading, setLoading] = useState(true)
	const [showCreate, setShowCreate] = useState(false)
	const [newCatName, setNewCatName] = useState('')
	const [creating, setCreating] = useState(false)

	useEffect(() => {
		const fetchTree = async () => {
			const res = await wikiApi.getCategoryTree()
			if (res.success && res.data) {
				setTree(res.data)
				setExpanded(new Set(res.data.map((c) => c.id)))
			}
			setLoading(false)
		}
		fetchTree()
	}, [])

	const toggleExpand = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const toggleSelect = (id: string) => {
		if (selected.includes(id)) {
			onChange(selected.filter((s) => s !== id))
		} else {
			onChange([...selected, id])
		}
	}

	const handleCreateCategory = async () => {
		if (!newCatName.trim()) return
		setCreating(true)
		const res = await wikiApi.createCategory({ name: newCatName.trim() })
		setCreating(false)
		if (res.success && res.data) {
			setNewCatName('')
			setShowCreate(false)
			const treeRes = await wikiApi.getCategoryTree()
			if (treeRes.success && treeRes.data) {
				setTree(treeRes.data)
				setExpanded(new Set(treeRes.data.map((c) => c.id)))
			}
			onChange([...selected, res.data.id])
		} else {
			alert(res.message || '创建分类失败')
		}
	}

	const renderNode = (node: WikiCategoryTreeNode, depth = 0) => {
		const hasChildren = node.children.length > 0
		const isExpanded = expanded.has(node.id)
		const isSelected = selected.includes(node.id)

		return (
			<div key={node.id}>
				<div
					className={cn(
						'flex items-center gap-1 rounded-sm px-2 py-1 text-[13px] transition-colors hover:bg-wiki-bg-tertiary',
						isSelected && 'bg-wiki-link/10',
					)}
					style={{ paddingLeft: `${depth * 20 + 8}px` }}
				>
					{hasChildren ? (
						<button
							type="button"
							onClick={() => toggleExpand(node.id)}
							className="flex-shrink-0 p-0.5"
						>
							{isExpanded ? (
								<ChevronDown className="h-3.5 w-3.5" />
							) : (
								<ChevronRight className="h-3.5 w-3.5" />
							)}
						</button>
					) : (
						<span className="w-5" />
					)}
					<label className="flex flex-1 cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={isSelected}
							onChange={() => toggleSelect(node.id)}
							className="h-3.5 w-3.5 rounded-sm border-wiki-border"
						/>
						<span>{node.name}</span>
						{node.pageCount > 0 && <span className="text-wiki-text-muted">({node.pageCount})</span>}
					</label>
				</div>
				{hasChildren && isExpanded && (
					<div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
				)}
			</div>
		)
	}

	if (loading) {
		return (
			<div className="flex items-center gap-2 py-2 text-[13px] text-wiki-text-muted">
				<Loader2 className="h-4 w-4 animate-spin" />
				加载分类...
			</div>
		)
	}

	return (
		<div className="">
			{tree.length > 0 ? (
				<div className="max-h-[200px] overflow-y-auto rounded-sm border border-wiki-border-light">
					<div className="p-1">{tree.map((node) => renderNode(node))}</div>
				</div>
			) : (
				<p className="text-[13px] text-wiki-text-muted">暂无分类</p>
			)}

			{showCreate ? (
				<div className="flex items-center gap-2">
					<Input
						value={newCatName}
						onChange={(e) => setNewCatName(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
						placeholder="新分类名称"
						className="flex-1"
					/>
					<Button
						size="sm"
						onClick={handleCreateCategory}
						disabled={creating || !newCatName.trim()}
					>
						{creating ? '...' : '创建'}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setShowCreate(false)
							setNewCatName('')
						}}
					>
						取消
					</Button>
				</div>
			) : (
				<Button
					variant="link"
					size="sm"
					onClick={() => setShowCreate(true)}
					className="h-auto px-0 text-[12px]"
				>
					<Plus className="mr-1 h-3 w-3" />
					新建分类
				</Button>
			)}
		</div>
	)
}
