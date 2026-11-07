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
import { PaperSheet } from '@/components/ui/paper-sheet'
import { ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { formatTagList, toggleTagInList } from '@/lib/thoughtTagFilter'
import { cn } from '@/lib/utils'
import { normalizeThoughtTag, parseThoughtTagList } from '@briar/shared'
import { Hash, Heart, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

const MAX_BODY = 2000

/** 想法列表统一票根纸，水平摆正（compose 区仍用 torn） */
function ThoughtTicketDecor() {
	return (
		<span
			aria-hidden
			className="rv-thought-card__deco rv-thought-card__deco--tr rv-script text-[11px] leading-none opacity-70"
		>
			admit
		</span>
	)
}

/** URL 形如 ?tag=a&tag=b；兼容旧的单个 ?tag=a 与逗号分隔 */
function readTagsFromUrl(): string[] {
	if (typeof window === 'undefined') return []
	return parseThoughtTagList(new URLSearchParams(window.location.search).getAll('tag'))
}

function writeTagsToUrl(tags: readonly string[], push: boolean) {
	const url = new URL(window.location.href)
	url.searchParams.delete('tag')
	for (const t of tags) url.searchParams.append('tag', t)
	if (url.href === window.location.href) return
	window.history[push ? 'pushState' : 'replaceState'](null, '', url)
}

function TagInsertButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
	return (
		<Button
			type="button"
			variant="default"
			size="sm"
			disabled={disabled}
			onClick={onClick}
			aria-label="插入标签"
			title="插入 #标签（输入时会联想已有标签）"
		>
			<Hash className="h-3.5 w-3.5" />
			标签
		</Button>
	)
}

/** 标签 chip：侧栏筛选 / 正文共用一套视觉 */
const tagChipBase =
	'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose-deep)]/30'
const tagChipIdle =
	'border-[color:var(--rv-rose-deep)]/30 bg-[var(--rv-pink)]/30 text-[color:var(--rv-rose-deep)] hover:border-[color:var(--rv-rose-deep)]/55 hover:bg-[var(--rv-pink)]/65'
const tagChipActive =
	'border-solid border-[color:var(--rv-rose-deep)]/45 bg-[color:color-mix(in_srgb,var(--rv-rose)_65%,transparent)] text-[color:var(--rv-rose-deep)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]'

/** 标签筛选条：热门标签，可多选；点一次选中、再点取消 */
function TagFilterBar({
	tags,
	activeTags,
	onToggle,
}: {
	tags: ThoughtTagCount[]
	activeTags: readonly string[]
	onToggle: (tag: string) => void
}) {
	const [query, setQuery] = useState('')
	const [expanded, setExpanded] = useState(false)
	if (tags.length === 0 && activeTags.length === 0) return null
	const q = normalizeThoughtTag(query)
	const filtered = q ? tags.filter((t) => t.tag.includes(q)) : tags
	const shown = expanded || q ? filtered : filtered.slice(0, 12)
	return (
		<ThoughtsAsideBlock
			label="热门标签"
			action={
				tags.length > 8 && (
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && filtered[0]) {
								onToggle(filtered[0].tag)
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
						const active = activeTags.includes(t.tag)
						return (
							<button
								key={t.tag}
								type="button"
								onClick={() => onToggle(t.tag)}
								title={active ? `再点一次取消 #${t.tag}` : `筛选 #${t.tag}`}
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
								{active && <X aria-hidden className="-mr-0.5 h-3 w-3 opacity-70" />}
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
			</div>
		</ThoughtsAsideBlock>
	)
}

/** 侧栏「小统计」：条数 / 标签数 / 当前列表获赞 */
function StatsCard({
	total,
	tagCount,
	items,
	activeTags,
}: {
	total: number
	tagCount: number
	items: Thought[]
	activeTags: readonly string[]
}) {
	const likes = items.reduce((n, t) => n + (t.likeCount ?? 0), 0)
	const cells: [string, number][] = [
		[
			activeTags.length === 0 ? '想法' : activeTags.length === 1 ? `#${activeTags[0]}` : '筛选结果',
			total,
		],
		['标签', tagCount],
		['获赞', likes],
	]
	return (
		<ThoughtsAsideBlock label="小统计" className="hidden lg:block">
			<dl className="grid grid-cols-3 divide-x divide-dashed divide-[color:var(--rv-navy)]/15 text-center">
				{cells.map(([k, v]) => (
					<div key={k} className="min-w-0 px-1">
						<dd className="font-label text-[26px] font-medium leading-none tabular-nums text-[color:var(--rv-navy)]">
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
	const [activeTags, setActiveTags] = useState<string[]>(() => readTagsFromUrl())
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
		const onPop = () => setActiveTags(readTagsFromUrl())
		window.addEventListener('popstate', onPop)
		return () => window.removeEventListener('popstate', onPop)
	}, [loadTags])

	/** 多选：未选中则加入，已选中则移除 */
	const toggleTag = useCallback((tag: string) => {
		setActiveTags((prev) => {
			const next = toggleTagInList(prev, tag)
			writeTagsToUrl(next, true)
			return next
		})
	}, [])
	/** 正文里点标签：只加入选择（已选中则不动），并回到顶部看结果 */
	const addTag = useCallback((tag: string) => {
		setActiveTags((prev) => {
			if (prev.includes(tag)) return prev
			const next = [...prev, tag]
			writeTagsToUrl(next, true)
			return next
		})
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}, [])
	const activeKey = activeTags.join(',')

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await listThoughts(1, 50, activeKey ? activeKey.split(',') : [])
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
	}, [activeKey])

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
				const matches =
					activeTags.length === 0 || (res.data.tags ?? []).some((t) => activeTags.includes(t))
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
		const toastId = toast('确定删除这条想法？', {
			description: '删除后无法恢复。',
			duration: 10000,
			action: (
				<Button
					variant="destructive"
					size="sm"
					className="shrink-0"
					onClick={() => {
						toast.dismiss(toastId)
						void confirmDelete(id)
					}}
				>
					删除
				</Button>
			),
			cancel: (
				<Button
					variant="secondary"
					size="sm"
					className="ml-auto shrink-0"
					onClick={() => toast.dismiss(toastId)}
				>
					取消
				</Button>
			),
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
						<TagFilterBar tags={tagCounts} activeTags={activeTags} onToggle={toggleTag} />
						<StatsCard
							total={total}
							tagCount={tagCounts.length}
							items={items}
							activeTags={activeTags}
						/>
					</aside>
					<section className="min-w-0">
						<header className="mb-6">
							<h1 className="text-3xl font-semibold tracking-tight">想法</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								一小段话就好 · 纯文本、emoji 与 #标签 ·{' '}
								{activeTags.length ? `${formatTagList(activeTags)} ` : ''}共 {total} 条
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
										variant="primary"
										onClick={() => void handlePublish()}
										disabled={!draft.trim() || publishing}
									>
										{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
								{activeTags.length
									? `还没有带 ${formatTagList(activeTags, ' 或 ')} 的想法。`
									: `还没有想法，${isAdmin ? '在上面写一条吧。' : '等管理员记一笔。'}`}
							</PaperSheet>
						)}

						<ul className="rv-stagger space-y-5">
							{items.map((t) => (
								<li key={t.id} className="rv-thought-card">
									<ThoughtCard
										thought={t}
										canEdit={!!isAdmin && user?.id === t.userId}
										canDelete={!!isAdmin && user?.id === t.userId}
										isLoggedIn={isLoggedIn}
										onDelete={() => void handleDelete(t.id)}
										onUpdated={handleUpdated}
										onLikeState={handleLikeState}
										knownTags={knownTags}
										activeTags={activeTags}
										onTagClick={addTag}
									/>
								</li>
							))}
						</ul>
					</section>
				</div>
			</main>
		</ThemeShell>
	)
}

function ThoughtCard({
	thought,
	canEdit,
	canDelete,
	isLoggedIn,
	onDelete,
	onUpdated,
	onLikeState,
	knownTags,
	activeTags,
	onTagClick,
}: {
	knownTags: string[]
	activeTags: readonly string[]
	onTagClick: (tag: string) => void
	thought: Thought
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
			variant="ticket"
			className="rv-thought-card"
			bodyClassName="!px-4 !py-4 sm:!px-5 sm:!py-5"
		>
			<ThoughtTicketDecor />
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
								variant="secondary"
								size="sm"
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
								variant="primary"
								onClick={() => void handleSave()}
								disabled={!editDraft.trim() || saving}
							>
								{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
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
						<LinkifiedText text={thought.body} onTagClick={onTagClick} activeTags={activeTags} />
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
