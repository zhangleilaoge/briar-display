'use client'

import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { type ReverieTheme, themeClass } from '@/lib/theme'
import { useEffect, useState } from 'react'
import { BasicExhibits } from './BasicExhibits'
import { DataExhibits } from './DataExhibits'
import { FormExhibits } from './FormExhibits'
import { OverlayExhibits } from './OverlayExhibits'
import { ThemeExhibits } from './ThemeExhibits'

const SECTIONS = [
	{ id: 'basics', label: '基础与导航', index: '01' },
	{ id: 'forms', label: '输入与选择', index: '02' },
	{ id: 'overlays', label: '浮层与反馈', index: '03' },
	{ id: 'content', label: '内容与动效', index: '04' },
	{ id: 'theme', label: '主题与纸艺', index: '05' },
]

function StylePageInner() {
	const [theme, setTheme] = useState<ReverieTheme>('scrapbook')

	useEffect(() => {
		const body = document.body
		const previous: ReverieTheme = body.classList.contains('theme-arcane') ? 'arcane' : 'scrapbook'
		body.classList.remove('theme-scrapbook', 'theme-arcane')
		body.classList.add(themeClass(theme))
		return () => {
			body.classList.remove('theme-scrapbook', 'theme-arcane')
			body.classList.add(themeClass(previous))
		}
	}, [theme])

	return (
		<ThemeShell variant={theme} className={themeClass(theme)}>
			<PageHeader
				crumbs={[{ label: '风格' }]}
				right={<Badge variant="outline">29 组 UI · 2 套主题</Badge>}
			/>
			<main className="rv-content-inset mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 md:pb-16">
				<header className="mb-7 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
					<div className="max-w-3xl">
						<p className="font-label text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
							Style · Cabinet des composants
						</p>
						<h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
							风格陈列室
						</h1>
						<p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
							这里不连接业务数据，只陈列真实的基础组件与交互。每个展品都直接引用
							<code className="mx-1 text-xs">components/ui</code>
							，用来确认组件边界，也用来比较两套主题。
						</p>
					</div>
					<div className="space-y-2 lg:text-right">
						<p className="font-label text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
							预览主题
						</p>
						<Tabs value={theme} onValueChange={(value) => setTheme(value as ReverieTheme)}>
							<TabsList aria-label="切换展览主题">
								<TabsTrigger value="scrapbook">Scrapbook 手账</TabsTrigger>
								<TabsTrigger value="arcane">Arcane 奥术</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</header>

				<nav
					aria-label="展品分区"
					className="glass-header sticky top-16 z-40 mb-6 flex gap-1 overflow-x-auto rounded-control border border-border/50 p-1 [scrollbar-width:none]"
				>
					{SECTIONS.map((section) => (
						<a
							key={section.id}
							href={`#${section.id}`}
							className="flex shrink-0 items-center gap-2 rounded-control px-3 py-2 font-control text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus"
						>
							<span className="font-display text-[11px] opacity-60">{section.index}</span>
							{section.label}
						</a>
					))}
				</nav>

				<div className="space-y-6">
					<BasicExhibits />
					<FormExhibits />
					<OverlayExhibits />
					<DataExhibits />
					<ThemeExhibits />
				</div>
			</main>
		</ThemeShell>
	)
}

export default function StylePage() {
	return (
		<PermissionProvider>
			<StylePageInner />
		</PermissionProvider>
	)
}
