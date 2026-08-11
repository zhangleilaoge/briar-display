'use client'

import { wikiApi } from '@/api/wiki'
import PermissionGuard from '@/components/wiki/common/PermissionGuard'
import TemplateFormDialog from '@/components/wiki/common/TemplateFormDialog'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import { WikiButton as Button } from '@/components/wiki/common/ui/button'
import { cn } from '@/lib/utils'
import { PERMISSIONS, type WikiTemplate } from '@briar/shared'
import { Calendar, Check, Copy, FileCode, Loader2, Pencil, Trash2, User } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface WikiTemplatePageProps {
	slug: string
}

function formatDate(date: Date | string) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

export default function WikiTemplatePage({ slug }: WikiTemplatePageProps) {
	const [template, setTemplate] = useState<WikiTemplate | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [showEdit, setShowEdit] = useState(false)
	const [deleting, setDeleting] = useState(false)

	const fetchTemplate = useCallback(async () => {
		const res = await wikiApi.getTemplate(slug)
		if (res.success && res.data) {
			setTemplate(res.data)
		} else {
			setError(res.message || '加载模板失败')
		}
		setLoading(false)
	}, [slug])

	useEffect(() => {
		fetchTemplate()
	}, [fetchTemplate])

	const handleDelete = async () => {
		if (!template) return
		if (!window.confirm(`确定删除模板「${template.name}」吗？此操作不可撤销。`)) return
		setDeleting(true)
		const res = await wikiApi.deleteTemplate(slug)
		if (res.success) {
			window.history.pushState({}, '', '/briar/wiki/special/templates')
			window.dispatchEvent(new PopStateEvent('popstate'))
		} else {
			alert(res.message || '删除失败')
			setDeleting(false)
		}
	}

	const handleCopy = () => {
		if (!template) return
		const reference = `{{${template.name}}}`
		navigator.clipboard.writeText(reference).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		})
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
				<Loader2 className="h-5 w-5 animate-spin" />
				加载中...
			</div>
		)
	}

	if (error || !template) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: '模板' }, { label: '错误' }]} />
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
					{error || '模板不存在'}
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '模板' }, { label: template.name }]} />

			<div className="flex items-center justify-between">
				<div>
					<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
						<FileCode className="h-5 w-5" />
						模板: {template.name}
					</h2>
					{template.description && (
						<p className="mt-1 text-muted-foreground text-sm">{template.description}</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					<PermissionGuard permission={PERMISSIONS.WIKI_TEMPLATE_UPDATE}>
						<Button size="sm" variant="outline" onClick={() => setShowEdit(true)}>
							<Pencil className="mr-1 h-3.5 w-3.5" />
							编辑
						</Button>
					</PermissionGuard>
					<PermissionGuard permission={PERMISSIONS.WIKI_TEMPLATE_DELETE}>
						<Button
							size="sm"
							variant="outline"
							className="text-red-600 hover:bg-red-50 hover:text-red-700"
							onClick={handleDelete}
							disabled={deleting}
						>
							{deleting ? (
								<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
							) : (
								<Trash2 className="mr-1 h-3.5 w-3.5" />
							)}
							删除
						</Button>
					</PermissionGuard>
				</div>
			</div>

			{/* Meta info */}
			<div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs">
				<span className="inline-flex items-center gap-1">
					<User className="h-3 w-3" />
					创建者: {template.authorId.slice(0, 8)}
				</span>
				<span className="inline-flex items-center gap-1">
					<Calendar className="h-3 w-3" />
					创建于 {formatDate(template.createdAt)}
				</span>
				{template.updatedAt !== template.createdAt && (
					<span className="inline-flex items-center gap-1">
						<Calendar className="h-3 w-3" />
						更新于 {formatDate(template.updatedAt)}
					</span>
				)}
				<span className="inline-flex items-center gap-1">
					<FileCode className="h-3 w-3" />
					使用次数: {template.usageCount.toLocaleString()}
				</span>
			</div>

			{/* Template content */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<h3 className="font-medium text-sm">模板内容</h3>
					<button
						type="button"
						onClick={handleCopy}
						className={cn(
							'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
							copied
								? 'bg-green-50 text-green-700 border border-green-200'
								: 'bg-muted text-foreground hover:bg-muted/80',
						)}
					>
						{copied ? (
							<>
								<Check className="h-3.5 w-3.5" />
								已复制
							</>
						) : (
							<>
								<Copy className="h-3.5 w-3.5" />
								使用此模板
							</>
						)}
					</button>
				</div>
				<pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
					<code>{template.content}</code>
				</pre>
			</div>

			{/* Usage hint */}
			<div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700 text-sm">
				<p className="font-medium">如何使用此模板</p>
				<p className="mt-1 text-blue-600 text-xs">
					在文章中添加{' '}
					<code className="rounded bg-blue-100 px-1 py-0.5">
						{'{{'}
						{template.name}
						{'}}'}
					</code>{' '}
					即可嵌入此模板的内容。
				</p>
			</div>

			<TemplateFormDialog
				open={showEdit}
				onClose={() => setShowEdit(false)}
				initialData={template}
				onSubmit={async (data) => {
					const res = await wikiApi.updateTemplate(slug, data)
					if (!res.success) throw new Error(res.message || '保存失败')
					await fetchTemplate()
				}}
			/>
		</div>
	)
}
