import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaperPanel } from '@/components/ui/theme-shell'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface StyleSectionProps {
	id: string
	index: string
	title: string
	caption: string
	description: string
	children: ReactNode
}

export function StyleSection({
	id,
	index,
	title,
	caption,
	description,
	children,
}: StyleSectionProps) {
	return (
		<section id={id} className="scroll-mt-32">
			<PaperPanel className="p-4 sm:p-6" autoHeight={false}>
				<header className="mb-5 flex flex-col gap-3 border-b border-[color:var(--rv-navy)]/15 pb-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="flex items-end gap-3">
						<span className="font-display text-3xl font-semibold text-transparent [-webkit-text-stroke:1px_var(--rv-navy)]">
							{index}
						</span>
						<div>
							<p className="font-label text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
								{caption}
							</p>
							<h2 className="font-heading text-2xl font-semibold">{title}</h2>
						</div>
					</div>
					<p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
				</header>
				<div className="grid gap-4">{children}</div>
			</PaperPanel>
		</section>
	)
}

interface StyleExhibitProps {
	title: string
	source: string
	children: ReactNode
	className?: string
	contentClassName?: string
}

export function StyleExhibit({
	title,
	source,
	children,
	className,
	contentClassName,
}: StyleExhibitProps) {
	return (
		<Card className={cn('overflow-visible', className)}>
			<CardHeader className="flex-row items-baseline justify-between gap-3 space-y-0 p-4 pb-3">
				<CardTitle className="text-base">{title}</CardTitle>
				<code className="truncate text-[10px] text-muted-foreground">{source}</code>
			</CardHeader>
			<CardContent className={cn('p-4 pt-0', contentClassName)}>{children}</CardContent>
		</Card>
	)
}
