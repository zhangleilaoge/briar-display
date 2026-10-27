'use client'

/**
 * 页面外壳：挂载全局吊牌侧栏 + 主题背景装饰。
 * 主题 token 本身由 Layout.astro 在 <body> 上加 theme-scrapbook / theme-arcane 类切换，
 * 这里只负责结构与装饰层（装饰全部 pointer-events-none，不影响交互）。
 */
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { Astrolabe } from './astrolabe'
import { GreekColumn, PocketWatch, Postmark, Strawberry } from './ornaments'
import { RibbonSidebar } from './ribbon-sidebar'

export interface ThemeShellProps {
	variant: 'scrapbook' | 'arcane'
	children: ReactNode
	className?: string
	/** 是否显示全局左侧吊牌导航 */
	sidebar?: boolean
	/** 是否显示背景装饰 */
	decor?: boolean
	currentPath?: string
}

export function ThemeShell({
	variant,
	children,
	className,
	sidebar = true,
	decor = true,
	currentPath,
}: ThemeShellProps) {
	return (
		<div className={cn('relative isolate min-h-screen', sidebar && 'md:pl-16', className)}>
			{sidebar && <RibbonSidebar currentPath={currentPath} />}
			{decor && (variant === 'arcane' ? <ArcaneDecor /> : <ScrapbookDecor />)}
			{children}
		</div>
	)
}

function ArcaneDecor() {
	return (
		<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			<Astrolabe
				className="absolute -bottom-40 -right-32 h-[560px] w-[560px] opacity-[0.22]"
				showWord={false}
			/>
			<GreekColumn className="absolute bottom-0 right-4 hidden h-[68vh] w-auto opacity-[0.16] xl:block" />
			<GreekColumn className="absolute bottom-0 left-20 hidden h-[52vh] w-auto -scale-x-100 opacity-[0.1] 2xl:block" />
			{/* HUD 角标线 */}
			<div className="absolute left-[calc(4rem+12px)] right-3 top-3 hidden h-px bg-[var(--rv-line)] opacity-40 md:block" />
		</div>
	)
}

function ScrapbookDecor() {
	return (
		<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			<Postmark className="absolute right-10 top-16 hidden h-28 w-28 rotate-12 opacity-30 lg:block" />
			<PocketWatch className="absolute -bottom-10 -right-6 hidden h-48 w-auto -rotate-12 opacity-[0.18] lg:block" />
			<div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-[var(--rv-pink)] opacity-50 blur-3xl" />
			<div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-[var(--rv-sky)] opacity-50 blur-3xl" />
		</div>
	)
}

export interface HudTitleProps {
	/** 编号，如 09 */
	index: string
	/** 法文/英文大写标签，如 RECHERCHE */
	label: string
	/** 中文标题 */
	title: string
	/** 花体副标题 */
	script?: string
	className?: string
}

/** Arcane HUD 标题块：「09 搜索 RECHERCHE」+ 花体副题 */
export function HudTitle({ index, label, title, script, className }: HudTitleProps) {
	return (
		<div className={cn('flex items-end gap-3 leading-none', className)}>
			<span className="font-display text-3xl font-semibold text-transparent [-webkit-text-stroke:1px_var(--rv-navy)]">
				{index}
			</span>
			<div className="flex flex-col gap-1">
				<span className="font-label text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
					{label}
				</span>
				<span className="font-heading text-lg font-semibold text-foreground">{title}</span>
			</div>
			{script && (
				<span className="rv-script hidden pb-0.5 text-lg text-muted-foreground sm:inline">
					{script}
				</span>
			)}
		</div>
	)
}

/** Scrapbook 小节标题：花体 + 衬线 */
export function ScrapTitle({
	script,
	title,
	className,
}: { script?: string; title: string; className?: string }) {
	return (
		<div className={cn('flex flex-col leading-tight', className)}>
			{script && (
				<span className="rv-script text-2xl text-[color:var(--rv-rose-deep)]">{script}</span>
			)}
			<span className="font-heading text-2xl font-semibold text-foreground">{title}</span>
		</div>
	)
}

/** 登录/注册页品牌拼贴：花体问候 + 衬线品牌名 + 邮戳 + 草莓 */
export function BrandCollage({
	script,
	subtitle,
	className,
}: { script: string; subtitle: string; className?: string }) {
	return (
		<div
			className={cn('relative flex flex-col items-center gap-3 px-10 py-12 text-center', className)}
		>
			<div className="rv-surface absolute inset-0 -rotate-2 rounded-surface border border-border/60 bg-card shadow-raised" />
			<div className="absolute inset-3 -rotate-2 rounded-[calc(var(--radius-surface)-6px)] border border-dashed border-[color:var(--rv-rose)]" />
			<span className="rv-script relative text-4xl text-[color:var(--rv-rose-deep)]">{script}</span>
			<h1 className="relative font-display text-6xl font-semibold tracking-tight text-foreground">
				xiaobuzi
			</h1>
			<p className="relative font-display text-xl italic text-muted-foreground">{subtitle}</p>
			<Postmark className="absolute -right-10 -top-10 h-28 w-28 rotate-12" />
			<Strawberry className="absolute -bottom-7 -left-5 h-16 w-16 -rotate-12" />
		</div>
	)
}
