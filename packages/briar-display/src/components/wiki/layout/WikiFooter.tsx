'use client'

import { cn } from '@/lib/utils'

interface WikiFooterProps {
	lastEdited?: string | Date
	lastEditor?: string
	viewCount?: number
	slug?: string
	className?: string
}

export default function WikiFooter({
	lastEdited,
	lastEditor,
	viewCount,
	slug: _slug,
	className,
}: WikiFooterProps) {
	const formatDate = (date: string | Date) => {
		const d = typeof date === 'string' ? new Date(date) : date
		return d.toLocaleString('zh-CN', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		})
	}

	return (
		<footer
			className={cn(
				'mt-6 border-t border-wiki-border-light pt-3 text-[12px] text-wiki-text-muted',
				className,
			)}
		>
			<p>
				本页面最后编辑于 {lastEdited ? formatDate(lastEdited) : '未知'}
				{lastEditor && (
					<>
						，由 <span className="text-wiki-text-secondary">{lastEditor}</span> 编辑
					</>
				)}
				。浏览次数: {viewCount != null ? viewCount.toLocaleString() : '0'}
			</p>
			<div className="mt-1.5 flex items-center gap-2">
				<a href="/briar/wiki/" className="hover:text-wiki-link hover:underline">
					首页
				</a>
				<span className="text-wiki-border-light">|</span>
				<a href="/briar/wiki/" className="hover:text-wiki-link hover:underline">
					关于
				</a>
			</div>
		</footer>
	)
}
