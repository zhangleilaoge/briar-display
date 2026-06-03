'use client'

import { cn } from '@/lib/utils'

interface WikiFooterProps {
	lastEditedAt?: string | Date
	lastEditedBy?: string
	viewCount?: number
	className?: string
}

export default function WikiFooter({
	lastEditedAt,
	lastEditedBy,
	viewCount,
	className,
}: WikiFooterProps) {
	const formatDate = (date: string | Date) => {
		const d = typeof date === 'string' ? new Date(date) : date
		return d.toLocaleString('zh-CN', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	return (
		<footer
			className={cn('mt-8 border-t border-border pt-4 text-muted-foreground text-xs', className)}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-3">
					{lastEditedAt && (
						<span>
							最后编辑于 {formatDate(lastEditedAt)}
							{lastEditedBy && <> by {lastEditedBy}</>}
						</span>
					)}
					{viewCount != null && <span>浏览: {viewCount.toLocaleString()}</span>}
				</div>
				<div className="flex items-center gap-3">
					<a href="/briar-display/wiki/" className="hover:text-foreground hover:underline">
						关于
					</a>
					<a href="/briar-display/wiki/" className="hover:text-foreground hover:underline">
						隐私政策
					</a>
					<a href="/briar-display/wiki/" className="hover:text-foreground hover:underline">
						免责声明
					</a>
				</div>
			</div>
		</footer>
	)
}
