'use client'

import UserMenu from '@/components/common/UserMenu'
import { Card, CardContent } from '@/components/ui/card'
import { ChatBubble } from '@/components/ui/chat-bubble'
import {
	FilesIcon,
	GothicArch,
	JournalIcon,
	KeyIcon,
	MarketsIcon,
	type OrnamentIconProps,
	Postmark,
	ToolsIcon,
} from '@/components/ui/ornaments'
import { PageHeader } from '@/components/ui/page-header'
import { StampInputBar } from '@/components/ui/stamp-input-bar'
import { ThemeShell } from '@/components/ui/theme-shell'
import { SITE_SECTIONS, type SectionMeta, type SubRouteMeta } from '@/config/site-routes'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import {
	type ComponentType,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'

interface Entry {
	icon: ComponentType<OrnamentIconProps>
	title: string
	caption: string
	description: string
	href: string
	adminOnly?: boolean
}

const ENTRIES: Entry[] = [
	{
		icon: ToolsIcon,
		title: '工具箱',
		caption: 'Outils',
		description: '文件 Diff、图片压缩等实用工具',
		href: '/briar/tools',
	},
	{
		icon: FilesIcon,
		title: '文件',
		caption: 'Fichiers',
		description: '文件、图片与视频的云端管理',
		href: '/briar/files',
	},
	{
		icon: JournalIcon,
		title: '博客',
		caption: 'Journal',
		description: '个人随笔与文章',
		href: '/briar/blog/',
	},
	{
		icon: KeyIcon,
		title: '管理后台',
		caption: 'Clef',
		description: '角色权限与用户管理',
		href: '/briar/admin',
		adminOnly: true,
	},
	{
		icon: MarketsIcon,
		title: '全球板块',
		caption: 'Étoiles',
		description: '全球主要市场板块涨跌',
		href: '/briar/markets',
	},
]

function EntryCard({
	entry,
	tilt,
	active,
	query,
}: { entry: Entry; tilt: number; active?: boolean; query: string }) {
	const Icon = entry.icon
	return (
		<a
			href={entry.href}
			data-active={active || undefined}
			className="group block outline-none data-[active]:-translate-y-1 transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
			style={{ rotate: `${tilt}deg` }}
		>
			<Card
				className={cn(
					'rv-tile glass-interactive overflow-hidden group-focus-visible:shadow-focus',
					active && 'shadow-focus',
				)}
			>
				<CardContent className="flex items-center gap-4 p-5">
					<div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--rv-rose)] bg-[var(--rv-pink)] shadow-[inset_0_2px_4px_rgb(255_255_255/0.9),inset_0_-2px_4px_rgb(185_84_95/0.18)]">
						<Icon className="h-7 w-7 text-[color:var(--rv-ink)]" />
					</div>
					<div className="min-w-0">
						<span className="rv-script block text-lg leading-none text-[color:var(--rv-rose-deep)]">
							{entry.caption}
						</span>
						<h3 className="font-heading text-lg font-semibold transition-colors group-hover:text-[color:var(--rv-rose-deep)]">
							<Highlight text={entry.title} query={query} />
						</h3>
						<p className="truncate text-sm text-muted-foreground">{entry.description}</p>
					</div>
				</CardContent>
			</Card>
		</a>
	)
}

/** 高亮匹配片段（大小写不敏感） */
function Highlight({ text, query }: { text: string; query: string }): ReactNode {
	const q = query.trim().toLowerCase()
	const idx = q ? text.toLowerCase().indexOf(q) : -1
	if (idx < 0) return text
	return (
		<>
			{text.slice(0, idx)}
			<mark className="rounded-[2px] bg-[color-mix(in_srgb,var(--rv-pink)_92%,var(--rv-cream))] px-0.5 text-[color:var(--rv-ink)] [box-decoration-break:clone]">
				{text.slice(idx, idx + q.length)}
			</mark>
			{text.slice(idx + q.length)}
		</>
	)
}

/** 分区在首页一级卡片上的视觉元数据（图标 / 法文 caption），子路由结果复用 */
const SECTION_LOOK: Record<
	SectionMeta['key'],
	{ icon: ComponentType<OrnamentIconProps>; caption: string }
> = {
	tools: { icon: ToolsIcon, caption: 'Outils' },
	admin: { icon: KeyIcon, caption: 'Clef' },
	markets: { icon: MarketsIcon, caption: 'Étoiles' },
}

interface SubHit {
	section: SectionMeta
	sub: SubRouteMeta
	/** 若不是名称命中，展示命中的别名/关键词 */
	hint?: string
}

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '')

/** 子路由仅在搜索时出现；名称命中优先，其次别名、拼音首字母、关键词 */
function searchSubRoutes(query: string, isAdmin: boolean): SubHit[] {
	const q = norm(query)
	if (!q) return []
	const hits: { hit: SubHit; rank: number }[] = []
	for (const section of SITE_SECTIONS) {
		if (section.adminOnly && !isAdmin) continue
		for (const sub of section.children) {
			const fields: [string | undefined, number][] = [
				[sub.label, 0],
				[sub.alias, 1],
				[sub.py, 2],
				[sub.keywords, 3],
				[section.title, 4],
			]
			const found = fields.find(([v]) => v && norm(v).includes(q))
			if (!found) continue
			const [value, rank] = found
			hits.push({
				hit: { section, sub, hint: rank === 0 || rank === 4 ? undefined : value },
				rank,
			})
		}
	}
	return hits.sort((a, b) => a.rank - b.rank).map((h) => h.hit)
}

function SubRouteRow({
	hit,
	query,
	active,
	index,
	tilt,
}: {
	hit: SubHit
	query: string
	active: boolean
	index: number
	tilt: number
}) {
	const look = SECTION_LOOK[hit.section.key]
	const Icon = look.icon
	const caption = hit.sub.alias || look.caption
	return (
		<a
			href={hit.sub.path}
			data-active={active || undefined}
			className="group relative block outline-none data-[active]:-translate-y-1 transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1 animate-[rv-rise_var(--motion-base)_var(--ease-paper)_both]"
			style={{ rotate: `${tilt}deg`, animationDelay: `${Math.min(index, 10) * 35}ms` }}
		>
			{/* 叠纸底片：与问候区同款，体量更轻，保持「次级」 */}
			<div
				aria-hidden
				className="rv-paper-back absolute inset-x-1 -bottom-0.5 top-2 -rotate-[1.2deg] rounded-md opacity-80"
			/>
			<Card
				className={cn(
					'relative z-[1] rv-tile glass-interactive overflow-hidden group-focus-visible:shadow-focus',
					active && 'shadow-focus',
				)}
			>
				<CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
					<div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--rv-rose)] bg-[var(--rv-pink)] shadow-[inset_0_2px_4px_rgb(255_255_255/0.9),inset_0_-2px_4px_rgb(185_84_95/0.18)]">
						<Icon className="h-5 w-5 text-[color:var(--rv-ink)]" />
					</div>
					<div className="min-w-0 flex-1">
						<span className="rv-script block truncate text-sm leading-none text-[color:var(--rv-rose-deep)]">
							<Highlight text={caption} query={query} />
						</span>
						<h3 className="truncate font-heading text-base font-semibold transition-colors group-hover:text-[color:var(--rv-rose-deep)]">
							<Highlight text={hit.sub.label} query={query} />
						</h3>
						<div className="mt-1 flex min-w-0 items-center gap-2">
							{/* 父分区：小邮票标签，替代「工具箱 ›」纯文本面包屑 */}
							<span className="rv-label inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-dashed border-[color:var(--rv-navy)]/35 bg-[color-mix(in_srgb,var(--rv-pink)_55%,white)] px-1.5 py-[3px] text-[10px] tracking-[0.1em] text-[color:var(--rv-ink)] shadow-[0_1px_0_hsl(0_0%_100%/0.9)_inset,0_1px_2px_hsl(221_46%_20%/0.08)]">
								<span
									aria-hidden
									className="h-1.5 w-1.5 rounded-full border border-[color:var(--rv-rose)] bg-[var(--rv-cream)] shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.6)]"
								/>
								{hit.section.title}
							</span>
							{hit.hint && hit.hint !== hit.sub.alias && (
								<p className="truncate text-xs text-muted-foreground">
									匹配：
									<Highlight text={hit.hint} query={query} />
								</p>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</a>
	)
}

/** 按本地时间问候；在 effect 中计算，避免 SSR/CSR 不一致 */
function useGreeting() {
	const [state, setState] = useState({ greet: 'Bonjour', date: '' })
	useEffect(() => {
		const now = new Date()
		const h = now.getHours()
		const greet = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'
		const date = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
		setState({ greet, date })
	}, [])
	return state
}

function PortalPageInner() {
	const { isAdmin, loading } = usePermissions()
	const { greet, date } = useGreeting()
	const [query, setQuery] = useState('')

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase()
		return ENTRIES.filter((e) => !e.adminOnly || isAdmin).filter(
			(e) => !q || `${e.title}${e.caption}${e.description}`.toLowerCase().includes(q),
		)
	}, [isAdmin, query])
	const subHits = useMemo(() => searchSubRoutes(query, isAdmin), [isAdmin, query])
	const results = useMemo(
		() => [...visible.map((e) => e.href), ...subHits.map((h) => h.sub.path)],
		[visible, subHits],
	)
	const [active, setActive] = useState(-1)
	const listRef = useRef<HTMLDivElement>(null)
	useEffect(() => setActive(-1), [query])
	useEffect(() => {
		listRef.current
			?.querySelector('[data-active]')
			?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
	}, [active])

	const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (!results.length) return
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setActive((i) => (i + 1) % results.length)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
		} else if (e.key === 'Enter' && query.trim()) {
			e.preventDefault()
			window.location.href = results[Math.max(active, 0)]
		} else if (e.key === 'Escape') {
			setQuery('')
		}
	}

	const tilts = [-1.2, 0.8, 1, -0.8, -1]

	return (
		<ThemeShell variant="scrapbook" watermark="01" className="flex flex-col overflow-hidden">
			{/* Top bar */}
			<PageHeader
				user={
					loading ? <div className="h-4 w-16 animate-pulse rounded-control bg-muted" /> : undefined
				}
			/>

			{/* Main */}
			<main className="flex flex-1 items-center justify-center p-4 sm:p-6">
				<div className="w-full max-w-3xl space-y-8">
					{/* 参考帧：多层剪纸拼贴问候区 */}
					<div className="relative mx-auto max-w-xl px-2 pb-4 pt-6 sm:px-6 sm:pb-6 sm:pt-8">
						{/* 底层倾斜纸片 */}
						<div
							aria-hidden
							className="rv-paper-back absolute inset-x-4 -bottom-1 top-10 -rotate-[3.5deg] rounded-md sm:inset-x-8"
						/>
						<div
							aria-hidden
							className="rv-paper-back absolute inset-x-6 -bottom-2 top-8 rotate-[2.5deg] rounded-md bg-[var(--rv-pink)]/55 sm:inset-x-10"
						/>
						{/* 旁侧：只留一处尖拱，留白 */}
						<GothicArch className="absolute -left-2 top-2 hidden h-32 w-auto -rotate-6 opacity-80 sm:-left-8 sm:block" />

						<Card className="relative z-[1] overflow-visible border-[color:var(--rv-navy)]/25 shadow-raised">
							<CardContent className="relative flex flex-col gap-2 p-6 sm:p-8">
								<span className="rv-label text-muted-foreground">
									Carnet de voyage · {date || '\u00a0'}
								</span>
								<h1 className="font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
									<span className="rv-script mr-2 font-normal text-[color:var(--rv-rose-deep)]">
										{greet},
									</span>
									xiaobuzi
								</h1>
								<p className="font-display text-lg italic text-muted-foreground">
									le salon du code est ouvert · 今天想去哪里看看？
								</p>
								<Postmark
									className="absolute -top-6 right-4 h-24 w-24 rotate-12 sm:right-8"
									date={date.slice(-2) || '27'}
								/>
							</CardContent>
						</Card>
					</div>

					{/* 邮票输入条：筛选下方入口 */}
					<div className="space-y-3">
						<p className="text-center font-display text-sm italic text-muted-foreground">
							或者，从这里开始 · ou commencez ici
						</p>
						<StampInputBar
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={onKeyDown}
							placeholder="Écrivez-moi…  输入关键词筛选入口"
							aria-label="筛选入口（↑↓ 选择，Enter 打开）"
						/>
						{query.trim() && (
							<ChatBubble from="user" className="mr-6">
								我想找：{query.trim()}
							</ChatBubble>
						)}
					</div>

					{/* 入口卡片 + 搜索时才出现的子路由结果 */}
					<div ref={listRef} className="space-y-6">
						{visible.length > 0 && (
							<div className="rv-stagger grid gap-5 sm:grid-cols-2">
								{visible.map((entry, i) => (
									<EntryCard
										key={entry.href}
										entry={entry}
										tilt={tilts[i % tilts.length]}
										active={active === i}
										query={query}
									/>
								))}
							</div>
						)}
						{subHits.length > 0 && (
							<section aria-label="子页面" className="space-y-3">
								<p className="flex items-center gap-3 px-1">
									<span aria-hidden className="h-px flex-1 bg-[color:var(--rv-navy)]/15" />
									<span className="inline-flex items-baseline gap-1.5">
										<span className="rv-label text-muted-foreground">子页面</span>
										<span className="rv-script text-sm text-[color:var(--rv-rose-deep)]">
											sous-pages
										</span>
										<span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full border border-[color:var(--rv-rose)]/40 bg-[var(--rv-pink)] px-1.5 font-label text-[10px] font-semibold text-[color:var(--rv-ink)]">
											{subHits.length}
										</span>
									</span>
									<span aria-hidden className="h-px flex-1 bg-[color:var(--rv-navy)]/15" />
								</p>
								<div className="rv-stagger grid gap-3 sm:grid-cols-2">
									{subHits.map((hit, i) => (
										<SubRouteRow
											key={hit.sub.path}
											hit={hit}
											query={query}
											index={i}
											tilt={tilts[(i + 2) % tilts.length] * 0.6}
											active={active === visible.length + i}
										/>
									))}
								</div>
							</section>
						)}
						{results.length === 0 && (
							<ChatBubble from="bot">
								没有找到「{query.trim()}
								」相关的入口或子页面，换个词试试？比如「json」「日志」「美股」。
							</ChatBubble>
						)}
						{query.trim() && results.length > 0 && (
							<p className="hidden text-center text-xs text-muted-foreground sm:block">
								↑↓ 选择 · Enter 打开 · Esc 清空
							</p>
						)}
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="pb-6 pt-8 text-center text-xs text-muted-foreground/80">
				<p className="font-display italic">Powered by zhangleilaoge</p>
				<a
					href="https://beian.miit.gov.cn/"
					target="_blank"
					rel="noopener noreferrer"
					className="mt-1 inline-block transition-colors hover:text-muted-foreground"
				>
					浙ICP备2024116093号-3
				</a>
			</footer>
		</ThemeShell>
	)
}

export default function PortalPage() {
	return (
		<PermissionProvider>
			<PortalPageInner />
		</PermissionProvider>
	)
}
