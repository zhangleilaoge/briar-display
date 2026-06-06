'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WikiPaginationProps {
	total: number
	limit: number
	offset: number
	onPageChange: (offset: number) => void
	className?: string
}

export default function WikiPagination({
	total,
	limit,
	offset,
	onPageChange,
	className,
}: WikiPaginationProps) {
	const totalPages = Math.max(1, Math.ceil(total / limit))
	const currentPage = Math.floor(offset / limit) + 1

	const handlePageChange = (page: number) => {
		const newOffset = (page - 1) * limit
		onPageChange(newOffset)
	}

	// Generate page numbers to show
	const pages: number[] = []
	const maxVisible = 7
	let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
	const end = Math.min(totalPages, start + maxVisible - 1)
	start = Math.max(1, end - maxVisible + 1)

	for (let i = start; i <= end; i++) {
		pages.push(i)
	}

	return (
		<nav
			aria-label="分页导航"
			className={cn('flex items-center justify-center gap-1 pt-4', className)}
		>
			<button
				type="button"
				disabled={currentPage <= 1}
				onClick={() => handlePageChange(currentPage - 1)}
				className={cn(
					'inline-flex h-8 items-center gap-1 rounded-sm px-3 text-[13px] transition-colors',
					currentPage <= 1
						? 'cursor-not-allowed text-wiki-text-muted'
						: 'border border-wiki-border-light text-wiki-text hover:bg-wiki-bg-secondary',
				)}
			>
				<ChevronLeft className="h-4 w-4" />
				上一页
			</button>

			{start > 1 && (
				<>
					<button
						type="button"
						onClick={() => handlePageChange(1)}
						className="inline-flex h-8 items-center justify-center rounded-sm border border-wiki-border-light px-3 text-[13px] text-wiki-text transition-colors hover:bg-wiki-bg-secondary"
					>
						1
					</button>
					{start > 2 && (
						<span className="inline-flex h-8 items-center px-1 text-[13px] text-wiki-text-muted">
							...
						</span>
					)}
				</>
			)}

			{total === 0 && (
				<span className="inline-flex h-8 items-center px-3 text-[13px] text-wiki-text-muted">
					共 0 条记录
				</span>
			)}

			{pages.map((page) => (
				<button
					type="button"
					key={page}
					onClick={() => handlePageChange(page)}
					className={cn(
						'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-sm px-3 text-[13px] transition-colors',
						page === currentPage
							? 'bg-wiki-link font-medium text-white hover:bg-wiki-link-hover'
							: 'border border-wiki-border-light text-wiki-text hover:bg-wiki-bg-secondary',
					)}
				>
					{page}
				</button>
			))}

			{end < totalPages && (
				<>
					{end < totalPages - 1 && (
						<span className="inline-flex h-8 items-center px-1 text-[13px] text-wiki-text-muted">
							...
						</span>
					)}
					<button
						type="button"
						onClick={() => handlePageChange(totalPages)}
						className="inline-flex h-8 items-center justify-center rounded-sm border border-wiki-border-light px-3 text-[13px] text-wiki-text transition-colors hover:bg-wiki-bg-secondary"
					>
						{totalPages}
					</button>
				</>
			)}

			<button
				type="button"
				disabled={currentPage >= totalPages}
				onClick={() => handlePageChange(currentPage + 1)}
				className={cn(
					'inline-flex h-8 items-center gap-1 rounded-sm px-3 text-[13px] transition-colors',
					currentPage >= totalPages
						? 'cursor-not-allowed text-wiki-text-muted'
						: 'border border-wiki-border-light text-wiki-text hover:bg-wiki-bg-secondary',
				)}
			>
				下一页
				<ChevronRight className="h-4 w-4" />
			</button>
		</nav>
	)
}
