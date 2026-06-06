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
	const totalPages = Math.ceil(total / limit)
	const currentPage = Math.floor(offset / limit) + 1

	if (total === 0) {
		return null
	}

	if (totalPages <= 1) {
		return (
			<div
				className={cn(
					'flex items-center justify-center pt-4 text-sm text-muted-foreground',
					className,
				)}
			>
				共 {total} 条记录
			</div>
		)
	}

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
					'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
					currentPage <= 1
						? 'cursor-not-allowed text-muted-foreground/50'
						: 'text-foreground hover:bg-muted',
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
						className="rounded-md px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
					>
						1
					</button>
					{start > 2 && <span className="px-1 text-muted-foreground">...</span>}
				</>
			)}

			{pages.map((page) => (
				<button
					type="button"
					key={page}
					onClick={() => handlePageChange(page)}
					className={cn(
						'rounded-md px-3 py-1.5 text-sm transition-colors',
						page === currentPage
							? 'bg-primary font-medium text-primary-foreground'
							: 'text-foreground hover:bg-muted',
					)}
				>
					{page}
				</button>
			))}

			{end < totalPages && (
				<>
					{end < totalPages - 1 && <span className="px-1 text-muted-foreground">...</span>}
					<button
						type="button"
						onClick={() => handlePageChange(totalPages)}
						className="rounded-md px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
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
					'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors',
					currentPage >= totalPages
						? 'cursor-not-allowed text-muted-foreground/50'
						: 'text-foreground hover:bg-muted',
				)}
			>
				下一页
				<ChevronRight className="h-4 w-4" />
			</button>
		</nav>
	)
}
