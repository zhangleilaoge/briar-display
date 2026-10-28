'use client'

import { createThought, deleteThought, listThoughts, type Thought } from '@/api/thoughts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Textarea } from '@/components/ui/textarea'
import { ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { Loader2, Send, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MAX_BODY = 2000
export default function ThoughtsPage() {
	return (
		<PermissionProvider>
			<ThoughtsPageInner />
		</PermissionProvider>
	)
}

function ThoughtsPageInner() {
	const { user, isAdmin, loading: permsLoading } = usePermissions()
	const [items, setItems] = useState<Thought[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [draft, setDraft] = useState('')
	const [publishing, setPublishing] = useState(false)
	const [publishError, setPublishError] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await listThoughts(1, 50)
			if (res.success && res.data) {
				setItems(res.data.items)
				setTotal(res.data.total)
			} else {
				setError(res.message || '加载失败')
			}
		} catch (e: any) {
			setError(e?.response?.data?.message || e?.message || '加载失败')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		void load()
	}, [load])

	const handlePublish = async () => {
		const text = draft.trim()
		if (!text || publishing) return
		setPublishing(true)
		setPublishError(null)
		try {
			const res = await createThought(text)
			if (res.success && res.data) {
				setDraft('')
				setItems((prev) => [res.data!, ...prev])
				setTotal((t) => t + 1)
			} else {
				setPublishError(res.message || '发布失败')
			}
		} catch (e: any) {
			setPublishError(e?.response?.data?.message || e?.message || '发布失败')
		} finally {
			setPublishing(false)
		}
	}

	const handleDelete = async (id: string) => {
		if (!confirm('确定删除这条想法？')) return
		try {
			const res = await deleteThought(id)
			if (res.success) {
				setItems((prev) => prev.filter((t) => t.id !== id))
				setTotal((t) => Math.max(0, t - 1))
			}
		} catch {
			/* ignore */
		}
	}

	return (
		<ThemeShell variant="scrapbook">
			<PageHeader crumbs={[{ label: '想法' }]} />

			<main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
				<header className="mb-6">
					<span className="rv-script text-2xl text-[color:var(--rv-rose-deep)]">Pensées</span>
					<h1 className="text-3xl font-semibold tracking-tight">想法</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						一小段话就好 · 纯文本与 emoji · 共 {total} 条
					</p>
				</header>

				{isAdmin && (
					<Card className="mb-6 overflow-hidden border-2 border-dashed border-[color:var(--rv-rose)]/40 bg-[color:var(--rv-paper)] shadow-none">
						<CardContent className="space-y-3 p-4 sm:p-5">
							<div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
								<span className="inline-block h-2 w-2 rotate-45 bg-[color:var(--rv-rose)]" />
								记一笔
							</div>
							<Textarea
								value={draft}
								onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
								placeholder="写点什么… 支持 emoji 😊"
								rows={4}
								className="min-h-[96px] resize-y rounded-none border-border/60 bg-background/60 font-normal"
							/>
							<div className="flex items-center justify-between gap-3">
								<span className="text-xs text-muted-foreground">
									{draft.trim().length}/{MAX_BODY}
								</span>
								<Button
									type="button"
									onClick={() => void handlePublish()}
									disabled={!draft.trim() || publishing}
									className="gap-1.5 rounded-none"
								>
									{publishing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Send className="h-4 w-4" />
									)}
									发布
								</Button>
							</div>
							{publishError && <p className="text-xs text-destructive">{publishError}</p>}
						</CardContent>
					</Card>
				)}

				{(loading || permsLoading) && (
					<div className="flex justify-center py-16 text-muted-foreground">
						<Loader2 className="h-6 w-6 animate-spin" />
					</div>
				)}

				{!loading && error && (
					<p className="rounded-none border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
						{error}
					</p>
				)}

				{!loading && !error && items.length === 0 && (
					<Card className="rounded-none border-dashed">
						<CardContent className="py-12 text-center text-sm text-muted-foreground">
							还没有想法，{isAdmin ? '在上面写一条吧。' : '等管理员记一笔。'}
						</CardContent>
					</Card>
				)}

				<ul className="space-y-4">
					{items.map((t, i) => (
						<li key={t.id} style={{ rotate: `${((i % 5) - 2) * 0.35}deg` }}>
							<ThoughtCard
								thought={t}
								canDelete={isAdmin && user?.id === t.userId}
								onDelete={() => void handleDelete(t.id)}
							/>
						</li>
					))}
				</ul>
			</main>
		</ThemeShell>
	)
}

function ThoughtCard({
	thought,
	canDelete,
	onDelete,
}: {
	thought: Thought
	canDelete: boolean
	onDelete: () => void
}) {
	const [expanded, setExpanded] = useState(false)
	const [overflows, setOverflows] = useState(false)
	const bodyRef = useRef<HTMLParagraphElement>(null)

	useEffect(() => {
		const el = bodyRef.current
		if (!el) return
		const check = () => {
			if (expanded) return
			setOverflows(el.scrollHeight > el.clientHeight + 1)
		}
		check()
		const ro = new ResizeObserver(check)
		ro.observe(el)
		return () => ro.disconnect()
	}, [thought.body, expanded])

	const timeLabel = useMemo(() => {
		const d = new Date(thought.createdAt)
		if (Number.isNaN(d.getTime())) return ''
		return d.toLocaleString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		})
	}, [thought.createdAt])

	const initial = thought.author?.name?.charAt(0)?.toUpperCase() || '?'

	return (
		<Card className="rounded-none border border-border/70 bg-[color:var(--rv-paper)] shadow-sm">
			<CardContent className="p-4 sm:p-5">
				<div className="mb-3 flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2.5">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
							{thought.author?.avatar ? (
								<img
									src={thought.author.avatar}
									alt=""
									className="h-full w-full object-cover"
								/>
							) : (
								<span className="text-sm font-medium text-muted-foreground">{initial}</span>
							)}
						</div>
						<div className="min-w-0">
							<p className="truncate text-sm font-medium">{thought.author?.name || '匿名'}</p>
							<p className="text-xs text-muted-foreground">{timeLabel}</p>
						</div>
					</div>
					{canDelete && (
						<button
							type="button"
							onClick={onDelete}
							className="rounded-none p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
							aria-label="删除"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					)}
				</div>

				<p
					ref={bodyRef}
					className={cn(
						'whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground',
						!expanded && 'line-clamp-5',
					)}
				>
					{thought.body}
				</p>

				{(overflows || expanded) && (
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						className="mt-2 text-xs font-medium text-[color:var(--rv-rose-deep)] underline-offset-2 hover:underline"
					>
						{expanded ? '收起' : '展开全部'}
					</button>
				)}
			</CardContent>
		</Card>
	)
}
