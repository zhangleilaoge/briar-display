'use client'

import UserMenu from '@/components/common/UserMenu'
import { Card, CardContent } from '@/components/ui/card'
import { ChatBubble } from '@/components/ui/chat-bubble'
import {
	FilesIcon,
	JournalIcon,
	KeyIcon,
	MarketsIcon,
	type OrnamentIconProps,
	Postmark,
	Ribbon,
	Strawberry,
	ToolsIcon,
} from '@/components/ui/ornaments'
import { StampInputBar } from '@/components/ui/stamp-input-bar'
import { ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { type ComponentType, useEffect, useMemo, useState } from 'react'

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

function EntryCard({ entry, tilt, index }: { entry: Entry; tilt: number; index: number }) {
	const Icon = entry.icon
	return (
		<a
			href={entry.href}
			className="group block outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
			style={{ rotate: `${tilt}deg` }}
		>
			<Card className="glass-interactive overflow-hidden group-focus-visible:shadow-focus">
				<CardContent className="relative flex items-center gap-4 p-5 sm:px-6">
					<span className="absolute right-4 top-3 font-label text-[9px] tracking-[0.18em] text-muted-foreground/70">
						{String(index + 1).padStart(2, '0')}
					</span>
					<div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--rv-rose)] bg-[var(--rv-pink)] shadow-[inset_0_2px_4px_rgb(255_255_255/0.9),inset_0_-2px_4px_rgb(185_84_95/0.18)]">
						<Icon className="h-7 w-7 text-[color:var(--rv-ink)]" />
					</div>
					<div className="min-w-0 pr-5">
						<span className="rv-script block text-lg leading-none text-[color:var(--rv-rose-deep)]">
							{entry.caption}
						</span>
						<h3 className="mt-0.5 font-heading text-xl font-semibold transition-colors group-hover:text-[color:var(--rv-rose-deep)]">
							{entry.title}
						</h3>
						<p className="mt-0.5 text-sm leading-5 text-muted-foreground">{entry.description}</p>
					</div>
					<span
						aria-hidden
						className="absolute bottom-3 right-4 font-display text-xl text-[color:var(--rv-rose-deep)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
					>
						↗
					</span>
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

	const tilts = [-0.55, 0.4, 0.35, -0.45, -0.4]

	return (
		<ThemeShell variant="scrapbook" className="flex flex-col overflow-hidden">
			<header className="glass-header sticky top-0 z-30 flex h-14 items-center justify-between px-4 sm:px-6">
				<span className="rv-script text-2xl leading-none text-foreground">xiaobuzi</span>
				<div className="flex items-center gap-3">
					{loading ? (
						<div className="h-4 w-16 animate-pulse rounded-control bg-muted" />
					) : (
						<UserMenu />
					)}
				</div>
			</header>

			<main className="flex flex-1 items-center justify-center px-4 py-7 sm:px-6 sm:py-9">
				<div className="w-full max-w-5xl space-y-7">
					<Card className="relative overflow-visible">
						<CardContent className="relative grid gap-8 p-6 sm:p-9 md:grid-cols-[minmax(0,1fr)_180px] md:p-10">
							<div className="relative z-10">
								<span className="rv-label text-muted-foreground">
									Carnet de voyage · {date || '\u00a0'}
								</span>
								<h1 className="mt-3 font-display text-4xl font-semibold leading-[0.95] text-foreground sm:text-6xl">
									<span className="rv-script block font-normal text-[color:var(--rv-rose-deep)]">
										{greet},
									</span>
									<span className="mt-2 block tracking-[-0.03em]">xiaobuzi</span>
								</h1>
								<p className="mt-4 font-display text-lg italic text-muted-foreground">
									今天想去哪里看看？
								</p>
								<p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
									工具、文件、行情与文字，都收在这本随时等待翻阅的册子里。
								</p>
							</div>
							<div className="relative hidden min-h-48 flex-col justify-between border-l border-dashed border-[color:var(--rv-rose)] pl-8 md:flex">
								<span className="rv-label text-muted-foreground">Index des pages</span>
								<div>
									<span className="block font-display text-7xl leading-none text-[color:var(--rv-ink)]">
										{String(visible.length).padStart(2, '0')}
									</span>
									<span className="mt-2 block font-label text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
										Destinations
									</span>
								</div>
								<p className="font-display text-sm italic leading-6 text-muted-foreground">
									Choisissez une page,
									<br />
									laissez-vous porter.
								</p>
							</div>
						</CardContent>
						<Postmark
							className="absolute -top-7 right-3 h-24 w-24 rotate-12 sm:right-5"
							date={date.slice(-2) || '27'}
						/>
						<Strawberry className="absolute -bottom-6 right-24 h-14 w-14 -rotate-12 sm:right-32" />
						<Ribbon className="absolute -left-5 -top-6 h-14 w-14 -rotate-[18deg]" />
					</Card>

					<div className="space-y-3">
						<div className="flex items-center justify-between gap-3 px-1">
							<span className="rv-label text-muted-foreground">Trouver une page</span>
							<span
								aria-live="polite"
								className="font-label text-[10px] tracking-[0.12em] text-muted-foreground"
							>
								{String(visible.length).padStart(2, '0')} 页可前往
							</span>
						</div>
						<StampInputBar
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Écrivez-moi…  输入关键词筛选入口"
							aria-label="筛选入口"
						/>
						{query.trim() && (
							<ChatBubble from="user" className="mr-6">
								我想找：{query.trim()}
							</ChatBubble>
						)}
					</div>

					<div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
						{visible.map((entry, i) => (
							<EntryCard key={entry.href} entry={entry} tilt={tilts[i % tilts.length]} index={i} />
						))}
						{visible.length === 0 && (
							<ChatBubble from="bot">没有找到相关入口，换个词试试？</ChatBubble>
						)}
					</div>
				</div>
			</main>

			<footer className="pb-6 pt-4 text-center text-xs text-muted-foreground/80">
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
