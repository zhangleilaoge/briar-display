'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import { cn } from '@/lib/utils'
import type { WikiCategoryTreeNode } from '@briar/shared'
import { ChevronDown, ChevronRight, FolderTree, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

function CategoryTreeNode({
	node,
	depth = 0,
	defaultExpanded,
}: {
	node: WikiCategoryTreeNode
	depth?: number
	defaultExpanded: boolean
}) {
	const hasChildren = node.children.length > 0
	const [expanded, setExpanded] = useState(defaultExpanded)

	return (
		<div>
			<div
				className={cn(
					'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted',
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

				<a
					href={`/briar-display/wiki/category/${node.slug}`}
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
			</div>

			{hasChildren && expanded && (
				<div>
					{node.children.map((child) => (
						<CategoryTreeNode
							key={child.id}
							node={child}
							depth={depth + 1}
							defaultExpanded={false}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export default function WikiCategoryIndex() {
	const [tree, setTree] = useState<WikiCategoryTreeNode[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const fetchTree = async () => {
			const res = await wikiApi.getCategoryTree()
			if (res.success && res.data) {
				setTree(res.data)
			} else {
				setError(res.message || '加载分类失败')
			}
			setLoading(false)
		}
		fetchTree()
	}, [])

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '分类' }]} />

			<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
				<FolderTree className="h-5 w-5" />
				分类浏览
			</h2>

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
							<CategoryTreeNode key={node.id} node={node} defaultExpanded={true} />
						))}
					</div>
				</div>
			)}
		</div>
	)
}
