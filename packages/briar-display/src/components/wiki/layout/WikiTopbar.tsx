'use client'

import SearchDropdown from '@/components/wiki/common/SearchDropdown'
import UserMenu from '@/components/wiki/layout/UserMenu'
import { cn } from '@/lib/utils'
import { Menu } from 'lucide-react'

interface WikiTopbarProps {
	onMenuToggle?: () => void
	className?: string
}

export default function WikiTopbar({ onMenuToggle, className }: WikiTopbarProps) {
	return (
		<header
			className={cn(
				'sticky top-0 z-50 flex h-[50px] items-center justify-between border-b border-wiki-border bg-wiki-topbar-bg px-4 shadow-sm',
				className,
			)}
		>
			{/* Left: hamburger + logo */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onMenuToggle}
					className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-wiki-text transition-colors hover:bg-wiki-bg-tertiary lg:hidden"
					aria-label="切换侧栏"
				>
					<Menu className="h-5 w-5" />
				</button>
				<a
					href="/briar-display/wiki/"
					className="flex items-center gap-2 text-wiki-text no-underline"
				>
					<span className="whitespace-nowrap text-[15px] font-semibold">Briar Wiki</span>
				</a>
			</div>

			{/* Center: search */}
			<div className="mx-4 hidden flex-1 md:block">
				<SearchDropdown />
			</div>

			{/* Right: user menu */}
			<div className="flex items-center justify-end gap-2">
				<UserMenu />
			</div>
		</header>
	)
}
