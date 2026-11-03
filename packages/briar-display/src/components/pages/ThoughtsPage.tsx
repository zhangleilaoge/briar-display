'use client'

import {
	type Thought,
	createThought,
	deleteThought,
	likeThought,
	listThoughtTags,
	listThoughts,
	unlikeThought,
	updateThought,
} from '@/api/thoughts'
import type { ThoughtTagCount } from '@/api/thoughts'
import { EmojiInsertButton } from '@/components/thoughts/EmojiInsertButton'
import { TagTextarea, type TagTextareaHandle } from '@/components/thoughts/TagTextarea'
import { ThoughtsAsideBlock } from '@/components/thoughts/ThoughtsAsideBlock'
import { Button } from '@/components/ui/button'
import { LinkifiedText } from '@/components/ui/linkified-text'
import { PageHeader } from '@/components/ui/page-header'
import { PaperSheet, type PaperSheetVariant } from '@/components/ui/paper-sheet'
import { ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { normalizeThoughtTag } from '@briar/shared'
import { Hash, Heart, Loader2, Pencil, Send, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

const MAX_BODY = 2000

/** 想法列表 5 款手账纸预设（compose 区仍用 torn，不在此列） */
const THOUGHT_PRESETS: PaperSheetVariant[] = ['stamp', 'polaroid', 'kraft', 'ticket', 'sticky']

/** 稳定哈希：同一 thought.id → 同一预设，无需 DB migration */
function hashThoughtId(id: string): number {
	let h = 2166136261
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

function thoughtPreset(id: string): PaperSheetVariant {
	return THOUGHT_PRESETS[hashThoughtId(id) % THOUGHT_PRESETS.length]!
}

function thoughtTilt(id: string): number {
	const h = hashThoughtId(id)
	const tilts = [-1.4, -0.7, 0.35, 0.9, -0.45, 1.1, -1.0]
	return tilts[h % tilts.length]!
}

function ThoughtScrapDecor({ preset }: { preset: PaperSheetVariant }) {
	if (preset === 'stamp') {
		return (
			<svg
				aria-hidden
				className="rv-thought-card__deco rv-thought-card__deco--tr h-5 w-5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			>
				<circle cx="12" cy="12" r="7" strokeDasharray="2 2" />
				<path d="M12 8v8M8 12h8" opacity="0.55" />
			</svg>
		)
	}
	if (preset === 'polaroid') {
		return (
			<svg
				aria-hidden
				className="rv-thought-card__deco rv-thought-card__deco--tl h-4 w-10"
				viewBox="0 0 40 16"
				fill="currentColor"
			>
				<path d="M2 14 L10 2 H30 L38 14 Z" opacity="0.28" />
			</svg>
		)
	}
	if (preset === 'kraft') {
		return (
			<svg
				aria-hidden
				className="rv-thought-card__deco rv-thought-card__deco--br h-4 w-4"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.1"
			>
				<path d="M2 8c2-4 4-4 6 0s4 4 6 0" opacity="0.55" />
			</svg>
		)
	}
	if (preset === 'ticket') {
		return (
			<span
				aria-hidden
				className="rv-thought-card__deco rv-thought-card__deco--tr rv-script text-[11px] leading-none opacity-70"
			>
				admit
			</span>
		)
	}
	/* sticky */
	return (
		<svg
			aria-hidden
			className="rv-thought-card__deco rv-thought-card__deco--tl h-3 w-8"
			viewBox="0 0 32 12"
			fill="currentColor"
		>
			<rect x="1" y="2" width="30" height="7" rx="1" opacity="0.35" />
		</svg>
	)
}

function readTagFromUrl(): string | null {
	if (typeof window === 'undefined') return null
	const raw = new URLSearchParams(window.location.search).get('tag')
	return raw ? normalizeThoughtTag(raw) || null : null
}

function writeTagToUrl(tag: string | null, push: boolean) {
	const url = new URL(window.location.href)
	if (tag) url.searchParams.set('tag', tag)
	else url.searchParams.delete('tag')
	if (url.href === window.location.href) return
	window.history[push ? 'pushState' : 'replaceState'](null, '', url)
}

function TagInsertButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className="inline-flex h-8 items-center gap-1 rounded-sm border border-dashed border-[color:var(--rv-rose-deep)]/45 bg-[var(--rv-pink)]/35 px-2.5 font-label text-[12px] tracking-[0.06em] text-[color:var(--rv-rose-deep)] transition-colors hover:border-[color:var(--rv-rose-deep)]/70 hover:bg-[var(--rv-pink)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose-deep)]/30 disabled:pointer-events-none disabled:opacity-50"
			aria-label="插入标签"
			title="插入 #标签（输入时会联想已有标签）"
		>
			<Hash className="h-3.5 w-3.5" />
			标签
		</button>
	)
}

/** 标签 chip：侧栏筛选 / 正文共用一套视觉 */
const tagChipBase =
	'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose-deep)]/30'
const tagChipIdle =
	'border-[color:var(--rv-rose-deep)]/30 bg-[var(--rv-pink)]/30 text-[color:var(--rv-rose-deep)] hover:border-[color:var(--rv-rose-deep)]/55 hover:bg-[var(--rv-pink)]/65'
const tagChipActive =
	'border-solid border-[color:var(--rv-rose-deep)]/45 bg-[color:color-mix(in_srgb,var(--rv-rose)_65%,transparent)] text-[color:var(--rv-rose-deep)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]'

/** 标签筛选条：热门标签 + 当前筛选 */
function TagFilterBar({
	tags,
	activeTag,
	onSelect,
}: {
	tags: ThoughtTagCount[]
	activeTag: string | null
	onSelect: (tag: string | null) => void
}) {
	const [query, setQuery] = useState('')
	const [expanded, setExpanded] = useState(false)
	if (tags.length === 0 && !activeTag) return null
	const q = normalizeThoughtTag(query)
	const filtered = q ? tags.filter((t) => t.tag.includes(q)) : tags
	const shown = expanded || q ? filtered : filtered.slice(0, 12)
	return (
		<ThoughtsAsideBlock
			script="mots-clés"
			label="热门标签"
			action={
				tags.length > 8 && (
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && filtered[0]) {
								onSelect(filtered[0].tag)
								setQuery('')
							}
						}}
						placeholder="搜标签…"
						className="h-8 w-24 min-w-0 rounded-sm border border-dashed border-[color:var(--rv-rose-deep)]/30 bg-[var(--rv-beige)]/80 px-2 text-[12px] outline-none placeholder:text-muted-foreground/70 focus:border-[color:var(--rv-rose-deep)]/60"
					/>
				)
			}
		>
			<div className="space-y-3">
				<div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
					{shown.map((t) => {
						const active = t.tag === activeTag
						return (
							<button
								key={t.tag}
								type="button"
								onClick={() => onSelect(active ? null : t.tag)}
								aria-pressed={active}
								className={cn(
									tagChipBase,
									'h-8 shrink-0 px-2.5 text-[13px] leading-none lg:h-7',
									active ? tagChipActive : tagChipIdle,
								)}
							>
								<span>#{t.tag}</span>
								<span className="font-label text-[10px] tabular-nums text-[color:var(--rv-navy)]/45">
									{t.count}
								</span>
							</button>
						)
					})}
					{!q && filtered.length > 12 && (
						<button
							type="button"
							onClick={() => setExpanded((v) => !v)}
							className="h-8 shrink-0 px-1 font-label text-[11px] tracking-[0.06em] text-muted-foreground underline-offset-4 hover:text-[color:var(--rv-rose-deep)] hover:underline lg:h-7"
						>
							{expanded ? '收起' : `更多 ${filtered.length - 12}`}
						</button>
					)}
				</div>
				{activeTag && (
					<div className="flex min-h-8 items-center justify-between gap-2 border-t border-dashed border-[color:var(--rv-navy)]/12 pt-2.5">
						<span className="min-w-0 truncate text-[13px] text-muted-foreground">
							正在看 <span className="text-[color:var(--rv-rose-deep)]">#{activeTag}</span>
						</span>
						<button
							type="button"
							onClick={() => onSelect(null)}
							className="inline-flex h-8 shrink-0 items-center gap-1 px-1 font-label text-[11px] tracking-[0.06em] text-muted-foreground underline-offset-4 transition-colors hover:text-[color:var(--rv-rose-deep)] hover:underline lg:h-7"
						>
							<X className="h-3 w-3" />
							清除筛选
						</button>
					</div>
				)}
			</div>
		</ThoughtsAsideBlock>
	)
}

/** 侧栏「小统计」：条数 / 标签数 / 当前列表获赞 */
function StatsCard({
	total,
	tagCount,
	items,
	activeTag,
}: {
	total: number
	tagCount: number
	items: Thought[]
	activeTag: string | null
}) {
	const likes = items.reduce((n, t) => n + (t.likeCount ?? 0), 0)
	const cells: [string, number][] = [
		[activeTag ? `#${activeTag}` : '想法', total],
		['标签', tagCount],
		['获赞', likes],
	]
	return (
		<ThoughtsAsideBlock script="en bref" label="小统计" className="hidden lg:block">
			<dl className="grid grid-cols-3 divide-x divide-dashed divide-[color:var(--rv-navy)]/15 text-center">
				{cells.map(([k, v]) => (
					<div key={k} className="min-w-0 px-1">
						<dd className="font-display text-2xl font-semibold leading-none tabular-nums text-[color:var(--rv-navy)]">
							{v}
						</dd>
						<dt className="mt-1.5 truncate font-label text-[10px] tracking-[0.12em] text-[color:var(--rv-navy)]/55">
							{k}
						</dt>
					</div>
				))}
			</dl>
		</ThoughtsAsideBlock>
	)
}

export default function ThoughtsPage() {
	return (
		<PermissionProvider>
			<ThoughtsPageInner />
		</PermissionProvider>
	)
}

function ThoughtsPageInner() {
	const { user, isAdmin, isLoggedIn, loading: permsLoading } = usePermissions()
	const [items, setItems] = useState<Thought[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [draft, setDraft] = useState('')
	const [publishing, setPublishing] = useState(false)
	const [publishError, setPublishError] = useState<string | null>(null)
	const [activeTag, setActiveTag] = useState<string | null>(() => readTagFromUrl())
	const [tagCounts, setTagCounts] = useState<ThoughtTagCount[]>([])
	const composeRef = useRef<TagTextareaHandle>(null)
	const knownTags = useMemo(() => tagCounts.map((t) => t.tag), [tagCounts])

	const loadTags = useCallback(async () => {
		try {
			const res = await listThoughtTags()
			if (res.success && res.data) setTagCounts(res.data)
		} catch {
			/* 标签条加载失败不影响列表 */
		}
	}, [])

	useEffect(() => {
		void loadTags()
		const onPop = () => setActiveTag(readTagFromUrl())
		window.addEventListener('popstate', onPop)
		return () => window.removeEventListener('popstate', onPop)
	}, [loadTags])

	const selectTag = useCallback((tag: string | null) => {
		setActiveTag(tag)
		writeTagToUrl(tag, true)
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}, [])

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await listThoughts(1, 50, activeTag)
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
	}, [activeTag])

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
				const matches = !activeTag || (res.data.tags ?? []).includes(activeTag)
				if (matches) {
					setItems((prev) => [res.data!, ...prev])
					setTotal((t) => t + 1)
				}
				void loadTags()
			} else {
				setPublishError(res.message || '发布失败')
			}
		} catch (e: any) {
			setPublishError(e?.response?.data?.message || e?.message || '发布失败')
		} finally {
			setPublishing(false)
		}
	}

	const confirmDelete = async (id: string) => {
		try {
			const res = await deleteThought(id)
			if (res.success) {
				setItems((prev) => prev.filter((t) => t.id !== id))
				setTotal((t) => Math.max(0, t - 1))
				void loadTags()
				toast.success('想法已删除')
			} else {
				toast.error(res.message || '删除失败，请稍后重试')
			}
		} catch (e: any) {
			toast.error(e?.response?.data?.message || e?.message || '删除失败，请稍后重试')
		}
	}

	const handleDelete = (id: string) => {
		toast('确定删除这条想法？', {
			description: '删除后无法恢复。',
			duration: 10000,
			action: { label: '删除', onClick: () => void confirmDelete(id) },
			cancel: { label: '取消', onClick: () => {} },
		})
	}

	const handleUpdated = (updated: Thought) => {
		setItems((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
		void loadTags()
	}

	const handleLikeState = (id: string, likeCount: number, likedByMe: boolean) => {
		setItems((prev) => prev.map((t) => (t.id === id ? { ...t, likeCount, likedByMe } : t)))
	}

	return (
		<ThemeShell variant="scrapbook">
			<PageHeader crumbs={[{ label: '想法' }]} />

			<main className="rv-content-inset mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-8">
					<aside className="order-first min-w-0 space-y-4 lg:sticky lg:top-24 lg:order-last lg:self-start">
						<TagFilterBar tags={tagCounts} activeTag={activeTag} onSelect={selectTag} />
						<StatsCard
							total={total}
							tagCount={tagCounts.length}
							items={items}
							activeTag={activeTag}
						/>
					</aside>
					<section className="min-w-0">
						<header className="mb-6">
							<span className="rv-script text-2xl text-[color:var(--rv-rose-deep)]">Pensées</span>
							<h1 className="text-3xl font-semibold tracking-tight">想法</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								一小段话就好 · 纯文本、emoji 与 #标签 · {activeTag ? `#${activeTag} ` : ''}共{' '}
								{total} 条
							</p>
						</header>

						{isAdmin && (
							<PaperSheet variant="torn" className="mb-6" bodyClassName="space-y-3">
								<div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
									<span className="inline-block h-2 w-2 rotate-45 bg-[color:var(--rv-rose)]" />
									记一笔
								</div>
								<TagTextarea
									ref={composeRef}
									value={draft}
									onChange={setDraft}
									maxLength={MAX_BODY}
									knownTags={knownTags}
									placeholder="写点什么… 支持 emoji 😊 和 #标签"
									className="min-h-[96px] resize-y rounded-none border-border/60 bg-[var(--rv-beige)]/80 font-normal"
								/>
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-2">
										<EmojiInsertButton
											disabled={publishing}
											onPick={(emoji) => setDraft((prev) => (prev + emoji).slice(0, MAX_BODY))}
										/>
										<TagInsertButton
											disabled={publishing}
											onClick={() => composeRef.current?.insertHash()}
										/>
										<span className="text-xs text-muted-foreground">
											{draft.trim().length}/{MAX_BODY}
										</span>
									</div>
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
							</PaperSheet>
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
							<PaperSheet
								variant="torn"
								bodyClassName="py-12 text-center text-sm text-muted-foreground"
							>
								{activeTag
									? `还没有带 #${activeTag} 的想法。`
									: `还没有想法，${isAdmin ? '在上面写一条吧。' : '等管理员记一笔。'}`}
							</PaperSheet>
						)}

						<ul className="rv-stagger space-y-5">
							{items.map((t) => {
								const preset = thoughtPreset(t.id)
								const tilt = thoughtTilt(t.id)
								return (
									<li key={t.id} className="rv-thought-card" style={{ rotate: `${tilt}deg` }}>
										<ThoughtCard
											thought={t}
											preset={preset}
											canEdit={!!isAdmin && user?.id === t.userId}
											canDelete={!!isAdmin && user?.id === t.userId}
											isLoggedIn={isLoggedIn}
											onDelete={() => void handleDelete(t.id)}
											onUpdated={handleUpdated}
											onLikeState={handleLikeState}
											knownTags={knownTags}
											activeTag={activeTag}
											onTagClick={selectTag}
										/>
									</li>
								)
							})}
						</ul>
					</section>
				</div>
			</main>
		</ThemeShell>
	)
}

function ThoughtCard({
	thought,
	preset,
	canEdit,
	canDelete,
	isLoggedIn,
	onDelete,
	onUpdated,
	onLikeState,
	knownTags,
	activeTag,
	onTagClick,
}: {
	knownTags: string[]
	activeTag: string | null
	onTagClick: (tag: string) => void
	thought: Thought
	preset: PaperSheetVariant
	canEdit: boolean
	canDelete: boolean
	isLoggedIn: boolean
	onDelete: () => void
	onUpdated: (t: Thought) => void
	onLikeState: (id: string, likeCount: number, likedByMe: boolean) => void
}) {
	const [expanded, setExpanded] = useState(false)
	const [overflows, setOverflows] = useState(false)
	const [editing, setEditing] = useState(false)
	const [editDraft, setEditDraft] = useState(thought.body)
	const [saving, setSaving] = useState(false)
	const [editError, setEditError] = useState<string | null>(null)
	const [liking, setLiking] = useState(false)
	const bodyRef = useRef<HTMLParagraphElement>(null)
	const editRef = useRef<TagTextareaHandle>(null)

	useEffect(() => {
		if (!editing) setEditDraft(thought.body)
	}, [thought.body, editing])

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
	}, [thought.body, expanded, editing])

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
	const likeCount = thought.likeCount ?? 0
	const likedByMe = !!thought.likedByMe

	const handleSave = async () => {
		const text = editDraft.trim()
		if (!text || saving) return
		setSaving(true)
		setEditError(null)
		try {
			const res = await updateThought(thought.id, text)
			if (res.success && res.data) {
				onUpdated(res.data)
				setEditing(false)
			} else {
				setEditError(res.message || '保存失败')
			}
		} catch (e: any) {
			setEditError(e?.response?.data?.message || e?.message || '保存失败')
		} finally {
			setSaving(false)
		}
	}

	const handleToggleLike = async () => {
		if (!isLoggedIn) {
			window.location.href = `/briar/login?redirect=${encodeURIComponent('/briar/thoughts')}`
			return
		}
		if (liking) return
		setLiking(true)
		const prevCount = likeCount
		const prevLiked = likedByMe
		// 乐观更新
		onLikeState(thought.id, prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1, !prevLiked)
		try {
			const res = prevLiked ? await unlikeThought(thought.id) : await likeThought(thought.id)
			if (res.success && res.data) {
				onLikeState(thought.id, res.data.likeCount, res.data.likedByMe)
			} else {
				onLikeState(thought.id, prevCount, prevLiked)
			}
		} catch {
			onLikeState(thought.id, prevCount, prevLiked)
		} finally {
			setLiking(false)
		}
	}

	return (
		<PaperSheet
			variant={preset}
			className="rv-thought-card"
			bodyClassName="!px-4 !py-4 sm:!px-5 sm:!py-5"
		>
			<ThoughtScrapDecor preset={preset} />
			<div className="mb-3 flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[var(--rv-beige)]">
						{thought.author?.avatar ? (
							<img src={thought.author.avatar} alt="" className="h-full w-full object-cover" />
						) : (
							<span className="text-sm font-medium text-muted-foreground">{initial}</span>
						)}
					</div>
					<div className="min-w-0">
						<p className="truncate text-sm font-medium">{thought.author?.name || '匿名'}</p>
						<p className="text-xs text-muted-foreground">{timeLabel}</p>
					</div>
				</div>
				{(canEdit || canDelete) && !editing && (
					<div className="flex shrink-0 items-center gap-0.5">
						{canEdit && (
							<button
								type="button"
								onClick={() => {
									setEditDraft(thought.body)
									setEditError(null)
									setEditing(true)
								}}
								className="rounded-none p-1.5 text-muted-foreground transition-colors hover:bg-[var(--rv-pink)]/50 hover:text-foreground"
								aria-label="编辑"
							>
								<Pencil className="h-3.5 w-3.5" />
							</button>
						)}
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
				)}
			</div>

			{editing ? (
				<div className="space-y-3">
					<TagTextarea
						ref={editRef}
						value={editDraft}
						onChange={setEditDraft}
						maxLength={MAX_BODY}
						knownTags={knownTags}
						className="min-h-[96px] resize-y rounded-none border-border/60 bg-[var(--rv-beige)]/80 font-normal"
						autoFocus
					/>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<EmojiInsertButton
								disabled={saving}
								onPick={(emoji) => setEditDraft((prev) => (prev + emoji).slice(0, MAX_BODY))}
							/>
							<TagInsertButton disabled={saving} onClick={() => editRef.current?.insertHash()} />
							<span className="text-xs text-muted-foreground">
								{editDraft.trim().length}/{MAX_BODY}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="default"
								size="sm"
								className="gap-1 rounded-none"
								onClick={() => {
									setEditing(false)
									setEditError(null)
								}}
								disabled={saving}
							>
								<X className="h-3.5 w-3.5" />
								取消
							</Button>
							<Button
								type="button"
								size="sm"
								className="gap-1 rounded-none"
								onClick={() => void handleSave()}
								disabled={!editDraft.trim() || saving}
							>
								{saving ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Send className="h-3.5 w-3.5" />
								)}
								保存
							</Button>
						</div>
					</div>
					{editError && <p className="text-xs text-destructive">{editError}</p>}
				</div>
			) : (
				<>
					<p
						ref={bodyRef}
						className={cn(
							'whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground',
							!expanded && 'line-clamp-5',
						)}
					>
						<LinkifiedText text={thought.body} onTagClick={onTagClick} activeTag={activeTag} />
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
				</>
			)}

			{!editing && (
				<div className="mt-3 flex items-center border-t border-[color:var(--rv-navy)]/10 pt-3">
					<button
						type="button"
						onClick={() => void handleToggleLike()}
						disabled={liking}
						className={cn(
							'inline-flex items-center gap-1.5 rounded-none px-2 py-1 text-xs transition-colors',
							likedByMe
								? 'text-[color:var(--rv-rose-deep)]'
								: 'text-muted-foreground hover:text-[color:var(--rv-rose-deep)]',
						)}
						aria-label={likedByMe ? '取消点赞' : '点赞'}
						aria-pressed={likedByMe}
						title={isLoggedIn ? undefined : '登录后点赞'}
					>
						<Heart className={cn('h-3.5 w-3.5', likedByMe && 'fill-current')} />
						<span>{likeCount}</span>
					</button>
				</div>
			)}
		</PaperSheet>
	)
}
