'use client'

import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

/**
 * 手账纸容器变体。
 * 已铺开：binder（门户问候）、torn（想法记一笔）、stamp（想法列表）、index（个人中心）。
 * 库存未铺开：sticky / polaroid / kraft / ticket —— 灵感来自 scrapbook / zine / Ephemera 纸 UI。
 */
export type PaperSheetVariant =
	| 'binder'
	| 'torn'
	| 'stamp'
	| 'sticky'
	| 'polaroid'
	| 'kraft'
	| 'ticket'
	| 'index'

/** 个人中心各卡片统一用这一款；其它变体留在组件里暂不铺开 */
export const PROFILE_PAPER: PaperSheetVariant = 'index'

export type PaperSheetProps = HTMLAttributes<HTMLDivElement> & {
	/** binder=活页孔；torn=撕边便签；stamp=邮票齿孔；sticky=便利贴；polaroid=拍立得；kraft=牛皮纸；ticket=票根齿边；index=索引卡 */
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
	sticky: 'px-4 pb-5 pt-6 sm:px-5 sm:pb-6 sm:pt-7',
	polaroid: 'px-3 pb-4 pt-3 sm:px-4 sm:pb-5 sm:pt-4',
	kraft: 'px-4 py-5 sm:px-5 sm:py-6',
	ticket: 'px-5 py-5 sm:px-6 sm:py-6',
	index: 'px-5 py-5 sm:px-6 sm:py-6',
}

/**
 * 差异化纸质容器：CSS+SVG 活页 / 撕边 / 邮票 / 便利贴 / 拍立得 / 牛皮 / 票根 / 索引卡。
 * 门户、想法、个人中心应选用不同 variant，避免全站同款圆角盒。
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
			{variant === 'sticky' && <span className="rv-paper-sheet__glue" aria-hidden />}
			{variant === 'polaroid' && <span className="rv-paper-sheet__polaroid-mat" aria-hidden />}
			{variant === 'ticket' && (
				<>
					<span className="rv-paper-sheet__perf rv-paper-sheet__perf--top" aria-hidden />
					<span className="rv-paper-sheet__perf rv-paper-sheet__perf--bottom" aria-hidden />
				</>
			)}
			{variant === 'index' && (
				<>
					<span className="rv-paper-sheet__index-hole" aria-hidden />
					<span className="rv-paper-sheet__index-rule" aria-hidden />
				</>
			)}
			<div className={cn('rv-paper-sheet__body', BODY_PAD[variant], bodyClassName)}>{children}</div>
		</div>
	)
}
