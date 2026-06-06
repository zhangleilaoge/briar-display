'use client'

import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import TagInput from '@/components/wiki/common/TagInput'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import CategorySelector from '@/components/wiki/editor/CategorySelector'
import VisualEditor, { type VisualEditorHandle } from '@/components/wiki/editor/VisualEditor'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import type { WikiPage, WikiPageVisibility } from '@briar/shared'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface WikiEditPageProps {
	slug: string
}

export default function WikiEditPage({ slug }: WikiEditPageProps) {
	const isNew = slug === 'new' || slug === ''
	const [title, setTitle] = useState('')
	const [sourceContent, setSourceContent] = useState('')
	const [editSummary, setEditSummary] = useState('')
	const [loading, setLoading] = useState(!isNew)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [existingPage, setExistingPage] = useState<WikiPage | null>(null)
	const [visibility, setVisibility] = useState<WikiPageVisibility>('public')
	const [tags, setTags] = useState<string[]>([])
	const [categoryIds, setCategoryIds] = useState<string[]>([])
	const [lastReadAt, setLastReadAt] = useState<string>('')

	const editorRef = useRef<VisualEditorHandle>(null)

	// Load existing page content
	useEffect(() => {
		if (isNew) return

		let cancelled = false
		setLoading(true)

		wikiApi.getPageDetails(slug).then((res) => {
			if (cancelled) return
			if (res.success && res.data) {
				const page = res.data
				setExistingPage(page)
				setTitle(page.title)
				setSourceContent(page.content)
				setVisibility(page.visibility || 'public')
				setLastReadAt(page.updatedAt)

				if (page.tags && page.tags.length > 0) {
					setTags(page.tags.map((t: any) => t.name))
				}

				if (page.categories && page.categories.length > 0) {
					setCategoryIds(page.categories.map((c: any) => c.id))
				}
			} else {
				setError(res.message || '加载文章失败')
			}
			setLoading(false)
		})

		return () => {
			cancelled = true
		}
	}, [slug, isNew])

	// Save handler
	const handleSave = useCallback(async () => {
		if (!title.trim()) {
			setError('请输入文章标题')
			return
		}

		setSaving(true)
		setError(null)

		const content = editorRef.current ? editorRef.current.getMarkdown() : sourceContent

		try {
			if (isNew) {
				const res = await wikiApi.createPage({
					title: title.trim(),
					content,
					visibility,
					tagNames: tags,
					categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
				})
				if (res.success && res.data) {
					window.history.pushState({}, '', `/briar-display/wiki/${res.data.slug}`)
					window.dispatchEvent(new PopStateEvent('popstate'))
				} else {
					setError(res.message || '创建失败')
				}
			} else {
				const payload: any = {
					title: title.trim(),
					content,
					visibility,
					tagNames: tags,
					categoryIds,
					editSummary: editSummary.trim() || undefined,
				}

				if (lastReadAt) {
					payload.lastReadAt = lastReadAt
				}

				const res = await wikiApi.updatePage(slug, payload)
				if (res.success && res.data) {
					window.history.pushState({}, '', `/briar-display/wiki/${res.data.slug}`)
					window.dispatchEvent(new PopStateEvent('popstate'))
				} else {
					setError(res.message || '保存失败')
				}
			}
		} catch (err: any) {
			if (err?.response?.status === 409) {
				setError('编辑冲突：此页面在你编辑期间已被修改，请刷新后重试')
			} else {
				setError('保存时发生错误')
			}
		} finally {
			setSaving(false)
		}
	}, [title, sourceContent, editSummary, isNew, slug, visibility, tags, categoryIds, lastReadAt])

	// Cancel handler
	const handleCancel = useCallback(() => {
		if (isNew) {
			window.history.pushState({}, '', '/briar-display/wiki/')
		} else {
			window.history.pushState({}, '', `/briar-display/wiki/${slug}`)
		}
		window.dispatchEvent(new PopStateEvent('popstate'))
	}, [isNew, slug])

	if (loading) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: isNew ? '新建文章' : '编辑文章' }]} />
				{!isNew && <WikiTabs slug={slug} active="edit" />}
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-wiki-text-muted" />
					<span className="ml-2 text-wiki-text-muted">加载中...</span>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs
				items={[
					{ label: existingPage?.title || slug, href: `/briar-display/wiki/${slug}` },
					{ label: isNew ? '新建' : '编辑' },
				]}
			/>
			{!isNew && <WikiTabs slug={slug} active="edit" />}

			<h1 className="border-b border-wiki-border-light pb-2 text-[1.5em] font-normal text-wiki-text">
				{isNew ? '新建文章' : `编辑: ${existingPage?.title || slug}`}
			</h1>

			{error && (
				<div className="rounded-sm border border-wiki-highlight bg-wiki-highlight px-4 py-3 text-[13px] text-wiki-link-red">
					{error}
				</div>
			)}

			{/* Title input */}
			<div>
				<label htmlFor="wiki-title" className="mb-3 block text-[13px] font-medium text-wiki-text">
					标题
				</label>
				<Input
					id="wiki-title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="输入文章标题"
				/>
			</div>

			{/* Visibility */}
			<div>
				<label className="mb-3 block text-[13px] font-medium text-wiki-text">可见性</label>
				<div className="flex gap-3">
					<label className="flex items-center gap-1.5 text-[13px] text-wiki-text">
						<input
							type="radio"
							name="visibility"
							value="public"
							checked={visibility === 'public'}
							onChange={() => setVisibility('public')}
							className="h-4 w-4 border-wiki-border text-wiki-link focus:ring-wiki-link"
						/>
						公开
					</label>
					<label className="flex items-center gap-1.5 text-[13px] text-wiki-text">
						<input
							type="radio"
							name="visibility"
							value="private"
							checked={visibility === 'private'}
							onChange={() => setVisibility('private')}
							className="h-4 w-4 border-wiki-border text-wiki-link focus:ring-wiki-link"
						/>
						私密（仅自己可见）
					</label>
					<label className="flex items-center gap-1.5 text-[13px] text-wiki-text">
						<input
							type="radio"
							name="visibility"
							value="link_only"
							checked={visibility === 'link_only'}
							onChange={() => setVisibility('link_only')}
							className="h-4 w-4 border-wiki-border text-wiki-link focus:ring-wiki-link"
						/>
						仅链接
					</label>
				</div>
			</div>

			{/* Tags */}
			<div>
				<label className="mb-3 block text-[13px] font-medium text-wiki-text">标签</label>
				<TagInput value={tags} onChange={setTags} />
				<p className="mt-1 text-[11px] text-wiki-text-muted">
					回车或逗号添加标签，输入时显示已有标签建议
				</p>
			</div>
			{/* Categories */}
			<div>
				<label className="mb-3 block text-[13px] font-medium text-wiki-text">分类</label>
				<CategorySelector selected={categoryIds} onChange={setCategoryIds} />
			</div>

			<label className="mb-3 block text-[13px] font-medium text-wiki-text">内容</label>
			<VisualEditor
				ref={editorRef}
				initialContent={sourceContent}
				onChange={(md) => setSourceContent(md)}
			/>

			{/* Edit summary & controls */}
			<div className="space-y-3 rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-4">
				<div>
					<label
						htmlFor="edit-summary"
						className="mb-3 block text-[13px] font-medium text-wiki-text"
					>
						编辑摘要
					</label>
					<Input
						id="edit-summary"
						value={editSummary}
						onChange={(e) => setEditSummary(e.target.value)}
						placeholder="简要描述你的更改（可选）"
					/>
				</div>
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-3 border-t border-wiki-border-light pt-4">
				<Button onClick={handleSave} disabled={saving}>
					{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{isNew ? '创建页面' : '保存更改'}
				</Button>
				<Button variant="outline" onClick={handleCancel} disabled={saving}>
					取消
				</Button>
			</div>
		</div>
	)
}
