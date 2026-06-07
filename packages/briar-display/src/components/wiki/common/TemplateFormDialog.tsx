'use client'

import { WikiButton as Button } from '@/components/wiki/common/ui/button'
import { WikiInput } from '@/components/wiki/common/ui/input'
import { WikiTextarea } from '@/components/wiki/common/ui/textarea'
import type { WikiTemplate } from '@briar/shared'
import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface TemplateFormDialogProps {
	open: boolean
	onClose: () => void
	onSubmit: (data: { name: string; content: string; description: string }) => Promise<void>
	initialData?: WikiTemplate | null
}

export default function TemplateFormDialog({
	open,
	onClose,
	onSubmit,
	initialData,
}: TemplateFormDialogProps) {
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const [content, setContent] = useState('')
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	const isEdit = !!initialData

	useEffect(() => {
		if (open) {
			setName(initialData?.name || '')
			setDescription(initialData?.description || '')
			setContent(initialData?.content || '')
			setError('')
			setSaving(false)
		}
	}, [open, initialData])

	useEffect(() => {
		if (open) {
			const handler = (e: KeyboardEvent) => {
				if (e.key === 'Escape') onClose()
			}
			document.addEventListener('keydown', handler)
			return () => document.removeEventListener('keydown', handler)
		}
	}, [open, onClose])

	const handleSubmit = async () => {
		if (!name.trim()) {
			setError('请输入模板名称')
			return
		}
		if (!content.trim()) {
			setError('请输入模板内容')
			return
		}
		setSaving(true)
		setError('')
		try {
			await onSubmit({ name: name.trim(), content, description: description.trim() })
			onClose()
		} catch (err: any) {
			setError(err?.message || '操作失败')
		} finally {
			setSaving(false)
		}
	}

	if (!open) return null

	return createPortal(
		<div className="fixed inset-0 z-[9999] flex items-center justify-center">
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close */}
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<div className="relative z-10 w-full max-w-lg rounded-md border border-border bg-background shadow-lg">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<h3 className="font-serif text-base font-normal text-foreground">
						{isEdit ? '编辑模板' : '创建模板'}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Body */}
				<div className="space-y-4 p-4">
					{error && (
						<div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
							{error}
						</div>
					)}

					<div className="space-y-1.5">
						<label className="text-[13px] font-medium text-foreground">名称</label>
						<WikiInput
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="例如: Infobox_character"
							disabled={isEdit}
						/>
						{!isEdit && (
							<p className="text-[12px] text-muted-foreground">创建后不可修改，将作为模板引用名</p>
						)}
					</div>

					<div className="space-y-1.5">
						<label className="text-[13px] font-medium text-foreground">描述</label>
						<WikiInput
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="简要说明模板用途（可选）"
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-[13px] font-medium text-foreground">内容</label>
						<WikiTextarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Markdown 内容，使用 {{参数名}} 作为占位符"
							className="min-h-[200px] font-mono text-[12px]"
						/>
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
					<Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
						取消
					</Button>
					<Button size="sm" onClick={handleSubmit} disabled={saving}>
						{saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
						{isEdit ? '保存' : '创建'}
					</Button>
				</div>
			</div>
		</div>,
		document.body,
	)
}
