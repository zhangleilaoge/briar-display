'use client'

/**
 * 页面外壳：挂载全局吊牌侧栏 + 主题背景装饰。
 * 背景层只保留水印 / 星盘系统件；具象贴纸由各页 accent 单点挂载，避免全站复用同一素材。
 */
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { Astrolabe } from './astrolabe'
import { AutoHeight } from './motion'
import { FleurDeLis, FloralRound } from './ornaments'
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
	/** 大号水印数字，如 09；不传则用主题默认 */
	watermark?: string
	/** 页面专属平面角饰（全站每种素材只用一次） */
	accent?: ReactNode
}

export function ThemeShell({
	variant,
	children,
	className,
	sidebar = true,
	decor = true,
	currentPath,
	watermark,
	accent,
}: ThemeShellProps) {
	return (
		<div className={cn('relative isolate min-h-screen', sidebar && 'md:pl-16', className)}>
			{sidebar && <RibbonSidebar currentPath={currentPath} />}
			{decor &&
				(variant === 'arcane' ? (
					<ArcaneDecor watermark={watermark} />
				) : (
					<ScrapbookDecor watermark={watermark} />
				))}
			{accent ? (
				<div
					aria-hidden
					className="pointer-events-none fixed bottom-10 right-6 z-0 hidden opacity-[0.16] xl:block"
				>
					{accent}
				</div>
			) : null}
			{children}
		</div>
	)
}

function ArcaneDecor({ watermark }: { watermark?: string }) {
	return (
		<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			<span className="rv-watermark-num absolute -left-4 top-6 text-[11rem] opacity-60 md:left-16 md:text-[14rem]">
				{watermark ?? '09'}
			</span>
			{/* 星盘为 Arcane HUD 系统件，各 Arcane 页共享；具象贴纸走 ThemeShell.accent */}
			<Astrolabe
				className="absolute -bottom-40 -right-32 h-[560px] w-[560px] opacity-[0.2]"
				showWord={false}
			/>
			<div className="absolute left-[calc(4rem+12px)] right-3 top-3 hidden h-px bg-[var(--rv-line)] opacity-40 md:block" />
			<div className="absolute bottom-4 left-[calc(4rem+12px)] right-3 hidden h-px bg-[var(--rv-line)] opacity-25 md:block" />
			<div className="absolute bottom-5 right-6 hidden items-center gap-2 font-label text-[9px] uppercase tracking-[0.22em] text-[color:var(--rv-navy)]/55 xl:flex">
				<span className="rv-barcode" />
				<span>XIAOBUZI · ARCHIVE</span>
			</div>
		</div>
	)
}

function ScrapbookDecor({ watermark }: { watermark?: string }) {
	return (
		<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			<span className="rv-watermark-num absolute -left-6 top-4 text-[10rem] opacity-35 md:left-14 md:text-[12rem]">
				{watermark ?? '01'}
			</span>
			{/* 无具象贴纸：邮戳/怀表/花饰改由各页单点挂载 */}
			<div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-[var(--rv-pink)] opacity-45 blur-3xl" />
			<div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-[var(--rv-sky)] opacity-45 blur-3xl" />
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
		<div className={cn('relative flex items-end gap-3 leading-none', className)}>
			<span className="font-display text-3xl font-semibold text-transparent [-webkit-text-stroke:1.25px_var(--rv-navy)]">
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

/** 登录/注册页品牌拼贴：花体问候 + 衬线品牌名 + 单枚平面角饰（登录鸢尾 / 注册圆花） */
export function BrandCollage({
	script,
	subtitle,
	className,
	motif = 'fleur',
}: {
	script: string
	subtitle: string
	className?: string
	motif?: 'fleur' | 'floral' | 'none'
}) {
	return (
		<div
			className={cn('relative flex flex-col items-center gap-3 px-10 py-12 text-center', className)}
		>
			<div className="rv-surface absolute inset-0 -rotate-2 rounded-surface border border-border/60 bg-card shadow-raised" />
			<div className="absolute inset-3 -rotate-2 rounded-[calc(var(--radius-surface)-6px)] border border-dashed border-[color:var(--rv-rose)]" />
			<div className="absolute -left-10 top-6 hidden h-28 w-20 -rotate-[14deg] rounded-sm border border-[color:var(--rv-navy)]/20 bg-[var(--rv-beige)] shadow-surface sm:block" />
			<div className="absolute -right-8 bottom-8 hidden h-24 w-28 rotate-[8deg] rounded-sm border border-[color:var(--rv-navy)]/15 bg-[var(--rv-pink)]/70 shadow-surface sm:block" />
			<span className="rv-script relative text-4xl text-[color:var(--rv-rose-deep)]">{script}</span>
			<h1 className="relative font-display text-6xl font-semibold tracking-tight text-foreground">
				xiaobuzi
			</h1>
			<p className="relative font-display text-xl italic text-muted-foreground">{subtitle}</p>
			{motif === 'fleur' ? (
				<FleurDeLis className="absolute -right-8 -top-8 h-16 w-16 rotate-12 opacity-90" />
			) : null}
			{motif === 'floral' ? (
				<FloralRound className="absolute -bottom-8 -left-6 h-20 w-20 -rotate-12 opacity-80" />
			) : null}
		</div>
	)
}

/** 内容面板：HUD 直角纸片 / 剪贴簿圆角纸（单层框线） */
export function PaperPanel({
	children,
	className,
	index,
	title,
	autoHeight = true,
}: {
	children: ReactNode
	className?: string
	index?: string
	title?: string
	/** 内容高度变化时平滑过渡；需撑满父级 flex 的面板（如工具箱）传 false */
	autoHeight?: boolean
}) {
	return (
		<section className={cn('rv-panel rv-page-enter relative', className)}>
			{/* 不再叠加外层裁切角标：面板自身描边 + 纹理已构成唯一框线，避免双层框 */}
			{(index || title) && (
				<header className="mb-3 flex items-end gap-3 border-b border-[color:var(--rv-navy)]/15 pb-2">
					{index && <span className="rv-index-box">{index}</span>}
					{title && (
						<span className="font-label text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
							{title}
						</span>
					)}
				</header>
			)}
			{autoHeight ? <AutoHeight>{children}</AutoHeight> : children}
		</section>
	)
}
