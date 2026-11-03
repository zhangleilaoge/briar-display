import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * 想法页侧栏专用信息块：与正文卡同一纸色、柔和描边与细颗粒，
 * 不再借用通用贴纸容器（stamp / kraft），保证两块成对出现。
 */
export function ThoughtsAsideBlock({
	script,
	label,
	action,
	className,
	children,
}: {
	/** 花体法文标题 */
	script: string
	/** Josefin 小号中文副标 */
	label: string
	/** 标题行右侧（如搜索框） */
	action?: ReactNode
	className?: string
	children: ReactNode
}) {
	return (
		<section
			className={cn(
				'relative min-w-0 overflow-hidden rounded-md border border-[color:var(--rv-rose-deep)]/15 px-4 py-3.5',
				'bg-[color:color-mix(in_srgb,var(--rv-beige)_82%,white)] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_4px_14px_-8px_rgba(28,43,75,0.22)]',
				className,
			)}
		>
			{/* 细纸纹 */}
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-multiply [background-image:radial-gradient(rgba(120,80,70,0.08)_1px,transparent_1px)] [background-size:3px_3px]"
			/>
			<header className="relative flex min-h-8 items-center justify-between gap-2 border-b border-dashed border-[color:var(--rv-rose-deep)]/15 pb-2">
				<div className="flex min-w-0 items-baseline gap-2">
					<span className="rv-script text-lg leading-none text-[color:var(--rv-rose-deep)]">
						{script}
					</span>
					<span className="truncate font-label text-[10px] uppercase tracking-[0.22em] text-[color:var(--rv-navy)]/55">
						{label}
					</span>
				</div>
				{action}
			</header>
			<div className="relative pt-3">{children}</div>
		</section>
	)
}
