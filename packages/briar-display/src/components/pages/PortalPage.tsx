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

function EntryCard({ entry, tilt }: { entry: Entry; tilt: number }) {
	const Icon = entry.icon
	return (
		<a
			href={entry.href}
			className="group block outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
			style={{ rotate: `${tilt}deg` }}
		>
			<Card className="rv-tile glass-interactive overflow-hidden group-focus-visible:shadow-focus">
				<CardContent className="flex items-center gap-4 p-5">
					<div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--rv-rose)] bg-[var(--rv-pink)] shadow-[inset_0_2px_4px_rgb(255_255_255/0.9),inset_0_-2px_4px_rgb(185_84_95/0.18)]">
						<Icon className="h-7 w-7 text-[color:var(--rv-ink)]" />
					</div>
					<div className="min-w-0">
						<span className="rv-script block text-lg leading-none text-[color:var(--rv-rose-deep)]">
							{entry.caption}
						</span>
						<h3 className="font-heading text-lg font-semibold transition-colors group-hover:text-[color:var(--rv-rose-deep)]">
							{entry.title}
						</h3>
						<p className="truncate text-sm text-muted-foreground">{entry.description}</p>
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
							placeholder="Écrivez-moi…  输入关键词筛选入口"
							aria-label="筛选入口"
						/>
						{query.trim() && (
							<ChatBubble from="user" className="mr-6">
								我想找：{query.trim()}
							</ChatBubble>
						)}
					</div>

					{/* 入口卡片 */}
					<div className="rv-stagger grid gap-5 sm:grid-cols-2">
						{visible.map((entry, i) => (
							<EntryCard key={entry.href} entry={entry} tilt={tilts[i % tilts.length]} />
						))}
						{visible.length === 0 && (
							<ChatBubble from="bot">没有找到相关入口，换个词试试？</ChatBubble>
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
