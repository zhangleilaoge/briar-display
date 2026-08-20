'use client'

import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { getReadingStats } from '@/lib/blog'
import { Copy, Eraser, PenLine, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

interface BlogSource {
	title: string
	body: string
	date?: string
	tags: string[]
	description?: string
}

interface ParsedMarkdown {
	title: string
	date: string
	tags: string[]
	body: string
	hasFrontmatter: boolean
}

const EMPTY_SOURCE: BlogSource = { title: '', body: '', tags: [] }

/** 从页面内嵌的 JSON 中读取当前文章的 Markdown 原文（构建期由 [...slug].astro 注入） */
function readEmbeddedSource(): BlogSource {
	if (typeof document === 'undefined') return EMPTY_SOURCE
	const el = document.getElementById('blog-md-source')
	if (!el?.textContent) return EMPTY_SOURCE
	try {
		const parsed = JSON.parse(el.textContent)
		return {
			title: parsed.title ?? '',
			body: parsed.body ?? '',
			date: parsed.date,
			tags: Array.isArray(parsed.tags) ? parsed.tags : [],
			description: parsed.description || undefined,
		}
	} catch {
		return EMPTY_SOURCE
	}
}

/** '2026-08-18' → '2026 年 8 月 18 日'（手动解析避免时区偏移）；无法解析时原样展示 */
function displayDate(dateStr: string): string {
	const m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
	if (!m) return dateStr
	return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`
}

function stripQuotes(value: string): string {
	return value.replace(/^['"]|['"]$/g, '')
}

/**
 * 切分并尽力解析 frontmatter（仅支持扁平 key: value，解析失败的行忽略）。
 * 输入中间态（frontmatter 未闭合、YAML 不完整）时按无 frontmatter 处理，正文原样渲染。
 */
function parseMarkdownFile(text: string): ParsedMarkdown {
	const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
	if (!fmMatch) {
		return { title: '', date: '', tags: [], body: text, hasFrontmatter: false }
	}
	const fm: Record<string, string> = {}
	for (const line of fmMatch[1].split(/\r?\n/)) {
		const m = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)
		if (m) fm[m[1]] = m[2].trim()
	}
	const rawTags = (fm.tags ?? '').replace(/^\[/, '').replace(/\]$/, '')
	const tags = rawTags
		.split(/[,，]/)
		.map((t) => stripQuotes(t.trim()))
		.filter(Boolean)
	return {
		title: stripQuotes(fm.title ?? ''),
		date: stripQuotes(fm.date ?? ''),
		tags,
		body: text.slice(fmMatch[0].length),
		hasFrontmatter: true,
	}
}

/** 把内嵌的文章数据重组为完整 Markdown 文件（重置用） */
function composeFullMarkdown(source: BlogSource): string {
	const lines = ['---', `title: ${source.title}`]
	if (source.date) lines.push(`date: ${source.date.slice(0, 10)}`)
	if (source.description) lines.push(`description: ${source.description}`)
	if (source.tags.length > 0) lines.push(`tags: [${source.tags.join(', ')}]`)
	lines.push('---')
	return `${lines.join('\n')}\n\n${source.body}`
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
		setDraft(composeFullMarkdown(source))
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

	const parsed = useMemo(() => parseMarkdownFile(draft), [draft])

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

	const stats = getReadingStats(parsed.body)

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
								onClick={() => setDraft(composeFullMarkdown(source))}
								title="恢复为当前文章原文"
								className={headerBtnCls}
							>
								<RotateCcw className="h-3.5 w-3.5" />
								重置
							</button>
							<button
								type="button"
								onClick={() => setDraft('')}
								title="全部清空，可粘贴任意 Markdown 预览"
								className={headerBtnCls}
							>
								<Eraser className="h-3.5 w-3.5" />
								清空
							</button>
							<button
								type="button"
								onClick={handleCopy}
								title="复制编辑内容（原样输出，含 frontmatter）"
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
							<div className="mx-auto max-w-2xl px-6 py-8">
								{/* 文头与真实文章页一致，frontmatter 随编辑实时解析 */}
								<header className="article-header !pt-0">
									<h1 className="article-title">
										{parsed.title || <span className="text-[var(--blog-muted)]">（无标题）</span>}
									</h1>
									<p className="article-meta">
										{parsed.date && (
											<>
												<time>{displayDate(parsed.date)}</time>
												<span className="post-item-dot" />
											</>
										)}
										<span>
											{stats.words} 字 · 约 {stats.minutes} 分钟
										</span>
									</p>
									{parsed.tags.length > 0 && (
										<ul className="article-tags">
											{parsed.tags.map((tag) => (
												<li key={tag}>{tag}</li>
											))}
										</ul>
									)}
									<div className="blog-ornament" aria-hidden="true">
										<span />
									</div>
								</header>
								<div className="blog-article">
									{parsed.body.trim() ? (
										<ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.body}</ReactMarkdown>
									) : (
										<p className="text-[var(--blog-muted)]">暂无内容，在右侧输入或粘贴 Markdown…</p>
									)}
								</div>
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
								placeholder="在这里编辑或粘贴完整 Markdown（含 frontmatter）…"
								className="min-h-0 flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed outline-none placeholder:text-[var(--blog-muted)]"
							/>
							<div className="flex shrink-0 items-center justify-between border-t border-[var(--blog-line)] px-5 py-1.5 text-[11px] text-[var(--blog-muted)]">
								<span>
									{parsed.hasFrontmatter
										? 'frontmatter ✓'
										: '无 frontmatter（顶部加 --- 块可定义标题/日期/标签）'}
								</span>
								<span>
									{stats.words} 字 · 约 {stats.minutes} 分钟
								</span>
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
