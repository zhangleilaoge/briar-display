'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AdminPaginationProps {
	total: number
	limit: number
	offset: number
	onPageChange: (offset: number) => void
	className?: string
}

export default function AdminPagination({
	total,
	limit,
	offset,
	onPageChange,
	className,
}: AdminPaginationProps) {
	const totalPages = Math.max(1, Math.ceil(total / limit))
	const currentPage = Math.floor(offset / limit) + 1

	const handlePageChange = (page: number) => {
		onPageChange((page - 1) * limit)
	}

	const pages: number[] = []
	const maxVisible = 7
	let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
	const end = Math.min(totalPages, start + maxVisible - 1)
	start = Math.max(1, end - maxVisible + 1)

	for (let i = start; i <= end; i++) {
		pages.push(i)
	}

	if (total <= limit) return null

	return (
		<nav
			aria-label="分页导航"
			className={cn('flex items-center justify-center gap-1 pt-4', className)}
		>
			<Button
				variant="outline"
				size="sm"
				disabled={currentPage <= 1}
				onClick={() => handlePageChange(currentPage - 1)}
				className="gap-1"
			>
				<ChevronLeft className="h-4 w-4" />
				上一页
			</Button>

			{start > 1 && (
				<>
					<Button variant="outline" size="sm" onClick={() => handlePageChange(1)}>
						1
					</Button>
					{start > 2 && <span className="px-1 text-sm text-muted-foreground">...</span>}
				</>
			)}

			{pages.map((page) => (
				<Button
					key={page}
					variant={page === currentPage ? 'default' : 'outline'}
					size="sm"
					onClick={() => handlePageChange(page)}
				>
					{page}
				</Button>
			))}

			{end < totalPages && (
				<>
					{end < totalPages - 1 && <span className="px-1 text-sm text-muted-foreground">...</span>}
					<Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)}>
						{totalPages}
					</Button>
				</>
			)}

			<Button
				variant="outline"
				size="sm"
				disabled={currentPage >= totalPages}
				onClick={() => handlePageChange(currentPage + 1)}
				className="gap-1"
			>
				下一页
				<ChevronRight className="h-4 w-4" />
			</Button>
		</nav>
	)
}
