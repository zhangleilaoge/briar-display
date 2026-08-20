'use client'

import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { getReadingStats } from '@/lib/blog'
import { Copy, Eraser, PenLine, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

interface BlogSource {
	title: string
	body: string
}

const EMPTY_SOURCE: BlogSource = { title: '', body: '' }

/** 从页面内嵌的 JSON 中读取当前文章的 Markdown 原文（构建期由 [...slug].astro 注入） */
function readEmbeddedSource(): BlogSource {
	if (typeof document === 'undefined') return EMPTY_SOURCE
	const el = document.getElementById('blog-md-source')
	if (!el?.textContent) return EMPTY_SOURCE
	try {
		const parsed = JSON.parse(el.textContent)
		return { title: parsed.title ?? '', body: parsed.body ?? '' }
	} catch {
		return EMPTY_SOURCE
	}
}

const headerBtnCls =
	'flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--blog-muted)] transition-colors hover:bg-[var(--blog-accent-soft)] hover:text-[var(--blog-accent)]'

function BlogEditorLauncherInner() {
	const { isAdmin } = usePermissions()
	const [source] = useState(readEmbeddedSource)
	const [open, setOpen] = useState(false)
	const [draft, setDraft] = useState('')
	const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

	const openEditor = () => {
		setDraft(source.body)
		setMobileTab('edit')
		setOpen(true)
	}

	// 打开时锁定背景滚动，Esc 关闭
	useEffect(() => {
		if (!open) return
		const prev = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false)
		}
		window.addEventListener('keydown', onKey)
		return () => {
			document.body.style.overflow = prev
			window.removeEventListener('keydown', onKey)
		}
	}, [open])

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(draft)
			toast.success('Markdown 已复制')
		} catch {
			toast.error('复制失败')
		}
	}, [draft])

	// Tab 键插入两个空格而不是切焦点
	const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key !== 'Tab') return
		e.preventDefault()
		const el = e.currentTarget
		const { selectionStart, selectionEnd } = el
		setDraft(`${draft.slice(0, selectionStart)}  ${draft.slice(selectionEnd)}`)
		requestAnimationFrame(() => {
			el.selectionStart = el.selectionEnd = selectionStart + 2
		})
	}

	if (!isAdmin || !source.body) return null

	const stats = getReadingStats(draft)

	return (
		<>
			{/* 悬浮入口（仅超管可见） */}
			<button
				type="button"
				onClick={openEditor}
				title="编辑预览（不会保存）"
				className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--blog-accent)] text-white shadow-lg transition-transform duration-300 hover:scale-110"
			>
				<PenLine className="h-5 w-5" />
			</button>

			{open && (
				<div className="fixed inset-0 z-[100] flex flex-col bg-[var(--blog-bg)] text-[var(--blog-ink)]">
					{/* 顶栏 */}
					<header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--blog-line)] px-3 sm:px-4">
						<span className="shrink-0 text-sm font-semibold">编辑预览</span>
						<span className="hidden truncate text-xs text-[var(--blog-muted)] sm:inline">
							{source.title} · 仅预览，不会保存
						</span>

						{/* 移动端：编辑 / 预览切换 */}
						<div className="ml-auto flex items-center gap-1 md:hidden">
							<button
								type="button"
								onClick={() => setMobileTab('edit')}
								className={`${headerBtnCls} ${mobileTab === 'edit' ? 'bg-[var(--blog-accent-soft)] text-[var(--blog-accent)]' : ''}`}
							>
								编辑
							</button>
							<button
								type="button"
								onClick={() => setMobileTab('preview')}
								className={`${headerBtnCls} ${mobileTab === 'preview' ? 'bg-[var(--blog-accent-soft)] text-[var(--blog-accent)]' : ''}`}
							>
								预览
							</button>
						</div>

						<div className="ml-auto flex items-center gap-1 md:ml-2">
							<button
								type="button"
								onClick={() => setDraft(source.body)}
								title="恢复为当前文章原文"
								className={headerBtnCls}
							>
								<RotateCcw className="h-3.5 w-3.5" />
								重置
							</button>
							<button
								type="button"
								onClick={() => setDraft('')}
								title="清空，可粘贴任意 Markdown 预览"
								className={headerBtnCls}
							>
								<Eraser className="h-3.5 w-3.5" />
								清空
							</button>
							<button
								type="button"
								onClick={handleCopy}
								title="复制编辑内容"
								className={headerBtnCls}
							>
								<Copy className="h-3.5 w-3.5" />
								复制
							</button>
							<button
								type="button"
								onClick={() => setOpen(false)}
								title="关闭（Esc）"
								className={headerBtnCls}
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</header>

					{/* 左右分栏：预览 | 编辑器（移动端按 tab 切换） */}
					<div className="flex min-h-0 flex-1">
						<div
							className={`min-w-0 flex-1 overflow-y-auto md:block ${
								mobileTab === 'preview' ? '' : 'hidden'
							}`}
						>
							<div className="blog-article mx-auto max-w-2xl px-6 py-8">
								{draft.trim() ? (
									<ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
								) : (
									<p className="text-[var(--blog-muted)]">暂无内容，在右侧输入或粘贴 Markdown…</p>
								)}
							</div>
						</div>
						<div
							className={`min-w-0 flex-1 flex-col border-l border-[var(--blog-line)] md:flex ${
								mobileTab === 'edit' ? 'flex' : 'hidden'
							}`}
						>
							<textarea
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={handleEditorKeyDown}
								spellCheck={false}
								placeholder="在这里编辑或粘贴 Markdown…"
								className="min-h-0 flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed outline-none placeholder:text-[var(--blog-muted)]"
							/>
							<div className="shrink-0 border-t border-[var(--blog-line)] px-5 py-1.5 text-right text-[11px] text-[var(--blog-muted)]">
								{stats.words} 字 · 约 {stats.minutes} 分钟
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	)
}

/** 博客文章页的超管编辑预览入口：悬浮按钮 → 全屏「左预览右编辑」覆盖层，不保存 */
export default function BlogEditorLauncher() {
	return (
		<PermissionProvider>
			<BlogEditorLauncherInner />
		</PermissionProvider>
	)
}
