'use client'

import UserMenu from '@/components/common/UserMenu'
import { GreetingStickers } from '@/components/portal/GreetingStickers'
import { WidgetDesktop } from '@/components/portal/WidgetDesktop'
import { Card, CardContent } from '@/components/ui/card'
import { ChatBubble } from '@/components/ui/chat-bubble'
import {
	FilesIcon,
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
import {
	type GreetingKind,
	dailyGreetingIndex,
	pickDailyGreeting,
	pickRandomGreeting,
	pickTimeOfDayGreeting,
} from '@/data/daily-greetings'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'
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
			className="group block outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1 data-[active]:-translate-y-1.5"
			style={{ rotate: `${tilt}deg` }}
		>
			<Card
				className={cn(
					'rv-tile glass-interactive overflow-hidden transition-[box-shadow,border-color,background-color] duration-200 group-focus-visible:shadow-focus',
					active &&
						'border-[color:var(--rv-navy)]/55 bg-[color-mix(in_srgb,var(--rv-pink)_42%,var(--rv-cream))] shadow-[0_0_0_2px_hsl(0_0%_100%/0.95),0_0_0_4px_color-mix(in_srgb,var(--rv-rose)_55%,transparent),0_10px_28px_-8px_hsl(221_46%_20%/0.28)]',
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
						<h3
							className={cn(
								'font-heading text-lg font-semibold transition-colors group-hover:text-[color:var(--rv-rose-deep)]',
								active && 'text-[color:var(--rv-rose-deep)]',
							)}
						>
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
			className="group relative block outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1 data-[active]:-translate-y-1.5 animate-[rv-rise_var(--motion-base)_var(--ease-paper)_both]"
			style={{ rotate: `${tilt}deg`, animationDelay: `${Math.min(index, 10) * 35}ms` }}
		>
			{/* 叠纸底片：与问候区同款，体量更轻，保持「次级」 */}
			<div
				aria-hidden
				className="rv-paper-back absolute inset-x-1 -bottom-0.5 top-2 -rotate-[1.2deg] rounded-md opacity-80"
			/>
			<Card
				className={cn(
					'relative z-[1] rv-tile glass-interactive overflow-hidden transition-[box-shadow,border-color,background-color] duration-200 group-focus-visible:shadow-focus',
					active &&
						'border-[color:var(--rv-navy)]/55 bg-[color-mix(in_srgb,var(--rv-pink)_42%,var(--rv-cream))] shadow-[0_0_0_2px_hsl(0_0%_100%/0.95),0_0_0_4px_color-mix(in_srgb,var(--rv-rose)_55%,transparent),0_10px_28px_-8px_hsl(221_46%_20%/0.28)]',
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
						<h3
							className={cn(
								'truncate font-heading text-base font-semibold transition-colors group-hover:text-[color:var(--rv-rose-deep)]',
								active && 'text-[color:var(--rv-rose-deep)]',
							)}
						>
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

/** 顶栏按时段问候；大字+谚语按日种子，可「换一句」随机换 */
function useGreeting() {
	const [state, setState] = useState({
		tod: '',
		greet: '',
		line: '',
		date: '',
		index: -1,
		kind: '' as '' | GreetingKind,
		decorSeed: 0,
	})
	const [spinning, setSpinning] = useState(false)
	useEffect(() => {
		const g = pickDailyGreeting()
		const index = dailyGreetingIndex()
		setState({
			tod: pickTimeOfDayGreeting(),
			greet: g.greet,
			line: g.line,
			date: g.dateLabel,
			index,
			kind: g.kind,
			decorSeed: (index + 1) * 9973,
		})
	}, [])
	const shuffle = () => {
		const next = pickRandomGreeting([state.index])
		setState((s) => ({
			...s,
			tod: pickTimeOfDayGreeting(),
			greet: next.greet,
			line: next.line,
			index: next.index,
			kind: next.kind,
			decorSeed: (next.index + 1) * 9973 + (s.decorSeed % 9973) + 17,
		}))
		setSpinning(true)
		window.setTimeout(() => setSpinning(false), 480)
	}
	return { ...state, spinning, shuffle }
}

function PortalPageInner() {
	const { isAdmin, loading } = usePermissions()
	const { tod, greet, line, date, kind, decorSeed, spinning, shuffle } = useGreeting()
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
		// sm+ 为 2 列网格：↑↓ 按行跳（±2），←→ 同排左右（±1）；窄屏单列时四向都按 ±1
		const cols =
			typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches ? 2 : 1
		const move = (delta: number) => {
			e.preventDefault()
			setActive((i) => {
				if (i < 0) return delta >= 0 ? 0 : results.length - 1
				const next = i + delta
				if (next < 0) return results.length - 1
				if (next >= results.length) return 0
				return next
			})
		}
		if (e.key === 'ArrowDown') move(cols)
		else if (e.key === 'ArrowUp') move(-cols)
		else if (e.key === 'ArrowRight') move(1)
		else if (e.key === 'ArrowLeft') move(-1)
		else if (e.key === 'Enter' && query.trim()) {
			e.preventDefault()
			window.location.href = results[Math.max(active, 0)]
		} else if (e.key === 'Escape') {
			setQuery('')
		}
	}

	const tilts = [-1.2, 0.8, 1, -0.8, -1]

	return (
		<ThemeShell variant="scrapbook" className="flex flex-col overflow-hidden">
			{/* Top bar */}
			<PageHeader
				hideBrand
				user={
					loading ? <div className="h-4 w-16 animate-pulse rounded-control bg-muted" /> : undefined
				}
			/>

			{/* Main */}
			<main className="flex flex-1 items-center justify-center p-4 sm:p-6">
				<div className="w-full max-w-3xl space-y-8 sm:max-w-4xl">
					{/* 参考帧：多层剪纸拼贴问候区；贴纸挂在外框光环，不进白卡 */}
					<div className="relative mx-auto max-w-xl overflow-visible px-5 pb-7 pt-9 sm:px-12 sm:pb-10 sm:pt-12">
						{/* 底层倾斜纸片 */}
						<div
							aria-hidden
							className="rv-paper-back absolute inset-x-4 -bottom-1 top-10 -rotate-[3.5deg] rounded-md sm:inset-x-8"
						/>
						<div
							aria-hidden
							className="rv-paper-back absolute inset-x-6 -bottom-2 top-8 rotate-[2.5deg] rounded-md bg-[var(--rv-pink)]/55 sm:inset-x-10"
						/>
						<GreetingStickers kind={kind} seed={decorSeed} />
						<Card className="relative z-[1] overflow-visible border-[color:var(--rv-navy)]/25 shadow-raised">
							<CardContent className="relative flex flex-col gap-2 p-6 pb-10 sm:p-8 sm:pb-11">
								<span className="relative z-[1] rv-label text-muted-foreground">
									{tod || '\u00a0'} · {date || '\u00a0'}
								</span>
								<h1 className="relative z-[1] font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
									<span className="rv-script font-normal text-[color:var(--rv-rose-deep)]">
										{greet || '\u00a0'}
									</span>
								</h1>
								<p className="relative z-[1] font-display text-lg text-muted-foreground">
									{line || '\u00a0'}
								</p>
								<Postmark
									className="absolute -top-6 right-4 h-24 w-24 rotate-12 sm:right-8"
									date={date.slice(-2) || '27'}
								/>
								<button
									type="button"
									onClick={shuffle}
									aria-label="换一句"
									title="换一句"
									className="absolute bottom-3 right-3 z-[2] inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--rv-navy)]/20 bg-[var(--rv-cream)]/90 text-[color:var(--rv-navy)]/70 shadow-sm transition hover:border-[color:var(--rv-rose)]/50 hover:text-[color:var(--rv-rose-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose)]/40 sm:bottom-4 sm:right-4"
								>
									<RefreshCw
										className={cn('h-3.5 w-3.5', spinning && 'animate-spin')}
										aria-hidden
									/>
								</button>
							</CardContent>
						</Card>
					</div>

					{/* 邮票输入条：筛选下方入口 */}
					<div className="space-y-3">
						<StampInputBar
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={onKeyDown}
							placeholder="输入关键词筛选入口"
							aria-label="筛选入口（↑↓←→ 选择，Enter 打开）"
						/>
					</div>

					{/* 空搜索：自定义桌面小组件；有关键词：一级入口 + 子路由筛选 */}
					{!query.trim() ? (
						<WidgetDesktop />
					) : (
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
							{results.length > 0 && (
								<p className="hidden text-center text-xs text-muted-foreground sm:block">
									↑↓←→ 选择 · Enter 打开 · Esc 清空
								</p>
							)}
						</div>
					)}
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
