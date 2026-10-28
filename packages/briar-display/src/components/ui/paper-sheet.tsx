'use client'

import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

export type PaperSheetVariant = 'binder' | 'torn' | 'stamp'

export type PaperSheetProps = HTMLAttributes<HTMLDivElement> & {
	/** binder=活页孔（门户问候）；torn=撕边便签（想法记一笔）；stamp=邮票齿孔（想法列表） */
	variant: PaperSheetVariant
	children: ReactNode
	/** 内容区内边距 class，默认按 variant 给合理值 */
	bodyClassName?: string
	/** binder 打孔数量 */
	holes?: number
}

const BODY_PAD: Record<PaperSheetVariant, string> = {
	binder: 'px-4 py-5 sm:px-6 sm:py-6',
	torn: 'px-4 py-5 sm:px-5 sm:py-6',
	stamp: 'px-5 py-5 sm:px-6 sm:py-6',
}

/**
 * 差异化纸质容器：CSS+SVG 活页 / 撕边 / 邮票，不透明奶油底。
 * 门户问候与想法页应选用不同 variant，避免全站同款圆角盒。
 */
export function PaperSheet({
	variant,
	children,
	className,
	bodyClassName,
	holes = 6,
	...rest
}: PaperSheetProps) {
	return (
		<div
			{...rest}
			className={cn('rv-paper-sheet', `rv-paper-sheet--${variant}`, className)}
			data-paper={variant}
		>
			{variant === 'binder' && (
				<div className="rv-paper-sheet__holes" aria-hidden>
					{Array.from({ length: holes }, (_, i) => (
						<span key={i} className="rv-paper-sheet__hole" />
					))}
				</div>
			)}
			{variant === 'torn' && <span className="rv-paper-sheet__tape" aria-hidden />}
			{variant === 'stamp' && (
				<>
					<span className="rv-paper-sheet__keyline" aria-hidden />
					<span className="rv-paper-sheet__keyline rv-paper-sheet__keyline--inner" aria-hidden />
				</>
			)}
			<div className={cn('rv-paper-sheet__body', BODY_PAD[variant], bodyClassName)}>{children}</div>
		</div>
	)
}
