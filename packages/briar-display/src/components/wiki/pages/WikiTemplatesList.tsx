'use client'

import { wikiApi } from '@/api/wiki'
import PermissionGuard from '@/components/wiki/common/PermissionGuard'
import TemplateFormDialog from '@/components/wiki/common/TemplateFormDialog'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import { WikiButton as Button } from '@/components/wiki/common/ui/button'
import { cn } from '@/lib/utils'
import { PERMISSIONS, type WikiTemplate } from '@briar/shared'
import { FileCode, Loader2, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const PAGE_SIZE = 50

export default function WikiTemplatesList() {
	const [templates, setTemplates] = useState<WikiTemplate[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [showCreate, setShowCreate] = useState(false)

	const loadTemplates = useCallback(async () => {
		setLoading(true)
		const res = await wikiApi.getTemplates(PAGE_SIZE, offset)
		if (res.success && res.data) {
			setTemplates(res.data.items || [])
			setTotal(res.data.total || 0)
		}
		setLoading(false)
	}, [offset])

	useEffect(() => {
		loadTemplates()
	}, [loadTemplates])

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '模板' }]} />

			<div className="flex items-center justify-between">
				<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
					<FileCode className="h-5 w-5" />
					模板
				</h2>
				<PermissionGuard permission={PERMISSIONS.WIKI_TEMPLATE_CREATE}>
					<Button size="sm" onClick={() => setShowCreate(true)}>
						<Plus className="mr-1 h-3.5 w-3.5" />
						创建模板
					</Button>
				</PermissionGuard>
			</div>

			<p className="text-muted-foreground text-sm">共 {total.toLocaleString()} 个模板</p>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={i} className="h-10 animate-pulse rounded bg-muted" />
					))}
				</div>
			) : templates.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<FileCode className="h-10 w-10 opacity-30" />
					<p className="text-sm">暂无模板</p>
				</div>
			) : (
				<div className="rounded-md border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border bg-muted/50">
								<th className="px-4 py-2 text-left font-medium text-muted-foreground">模板名称</th>
								<th className="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
									描述
								</th>
								<th className="hidden px-4 py-2 text-right font-medium text-muted-foreground md:table-cell">
									使用次数
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/50">
							{templates.map((template) => (
								<tr key={template.id} className="transition-colors hover:bg-muted/30">
									<td className="px-4 py-2">
										<a
											href={`/briar-display/wiki/template/${template.slug}`}
											className="text-wiki-link hover:underline"
										>
											{template.name}
										</a>
									</td>
									<td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">
										{template.description || '-'}
									</td>
									<td className="hidden px-4 py-2 text-right text-muted-foreground md:table-cell">
										{template.usageCount.toLocaleString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<WikiPagination
				total={total}
				limit={PAGE_SIZE}
				offset={offset}
				onPageChange={(newOffset) => {
					setOffset(newOffset)
				}}
			/>

			<TemplateFormDialog
				open={showCreate}
				onClose={() => setShowCreate(false)}
				onSubmit={async (data) => {
					const res = await wikiApi.createTemplate(data)
					if (!res.success) throw new Error(res.message || '创建失败')
					loadTemplates()
				}}
			/>
		</div>
	)
}
