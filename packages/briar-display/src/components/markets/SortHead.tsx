import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SortDirection } from './marketUtils'

interface SortHeadProps<K extends string> {
	sortKey: K
	label: ReactNode
	current: K
	direction: SortDirection
	sortable: boolean
	onSort?: (key: K) => void
	className?: string
	align?: 'left' | 'right'
	title?: string
}

/** 可点击排序的表头（板块列表 / 成分股共用）：当前列显示方向箭头，其余列悬停时显示淡箭头 */
export default function SortHead<K extends string>({
	sortKey,
	label,
	current,
	direction,
	sortable,
	onSort,
	className,
	align = 'right',
	title,
}: SortHeadProps<K>) {
	const active = current === sortKey
	const Icon = !active ? ArrowUpDown : direction === 'desc' ? ArrowDown : ArrowUp
	return (
		<TableHead
			className={cn(align === 'right' && 'text-right', className)}
			aria-sort={active ? (direction === 'desc' ? 'descending' : 'ascending') : undefined}
			title={title}
		>
			{sortable && onSort ? (
				<button
					type="button"
					onClick={() => onSort(sortKey)}
					className={cn(
						'group inline-flex items-start gap-0.5 hover:text-foreground',
						align === 'right' && 'flex-row-reverse text-right',
						active && 'text-foreground',
					)}
					title={title ? `${title}（点击排序：先降序，再点升序）` : '点击排序：先降序，再点升序'}
				>
					<span>{label}</span>
					<Icon
						className={cn(
							'mt-0.5 h-3.5 w-3.5 shrink-0',
							active ? 'text-sky-600' : 'opacity-0 transition-opacity group-hover:opacity-50',
						)}
					/>
				</button>
			) : (
				label
			)}
		</TableHead>
	)
}
