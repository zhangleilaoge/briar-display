'use client'

import SearchDropdown from '@/components/wiki/common/SearchDropdown'
import UserMenu from '@/components/wiki/layout/UserMenu'
import { cn } from '@/lib/utils'
import { Menu, Plus } from 'lucide-react'

interface WikiTopbarProps {
	onMenuToggle?: () => void
	className?: string
}

export default function WikiTopbar({ onMenuToggle, className }: WikiTopbarProps) {
	return (
		<header
			className={cn(
				'sticky top-0 z-50 flex h-[50px] items-center border-b border-wiki-border bg-wiki-topbar-bg px-4 shadow-sm',
				className,
			)}
		>
			{/* Left: hamburger + logo */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onMenuToggle}
					className="inline-flex h-8 w-8 items-center justify-center rounded text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text lg:hidden"
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
			<div className="mx-auto hidden max-w-md flex-1 px-6 md:block">
				<SearchDropdown />
			</div>

			{/* Right: new article + user menu */}
			<div className="flex items-center gap-2">
				<a
					href="/briar-display/wiki/new"
					className="inline-flex items-center gap-1.5 rounded bg-[#3366cc] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2a4b8d]"
				>
					<Plus className="h-3.5 w-3.5" />
					<span className="hidden sm:inline">新建文章</span>
				</a>
				<UserMenu />
			</div>
		</header>
	)
}
