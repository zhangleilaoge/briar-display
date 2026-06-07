'use client'

import WikiSidebar from '@/components/wiki/layout/WikiSidebar'
import WikiTopbar from '@/components/wiki/layout/WikiTopbar'
import { cn } from '@/lib/utils'
import { type ReactNode, useState } from 'react'

interface WikiLayoutProps {
	children: ReactNode
	showSidebar?: boolean
}

export default function WikiLayout({ children, showSidebar = true }: WikiLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false)

	return (
		<div className="wiki-theme min-h-screen bg-[#f8f9fa]">
			{/* Topbar */}
			<WikiTopbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

			{/* Mobile sidebar overlay */}
			{showSidebar && sidebarOpen && (
				<div
					className="fixed inset-0 z-30 bg-black/40 lg:hidden"
					onClick={() => setSidebarOpen(false)}
					onKeyDown={(e) => e.key === 'Escape' && setSidebarOpen(false)}
					role="button"
					tabIndex={0}
					aria-label="关闭侧栏遮罩"
				/>
			)}

			<div className="flex">
				{/* Sidebar */}
				{showSidebar && (
					<aside
						className={cn(
							'fixed left-0 z-40 w-[250px] overflow-y-auto border-r border-wiki-border-light bg-wiki-bg-secondary transition-transform lg:sticky lg:top-[50px] lg:block lg:translate-x-0',
							'top-[50px] h-[calc(100vh-50px)]',
							sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
						)}
					>
						<WikiSidebar />
					</aside>
				)}

				{/* Main content */}
				<main className={cn('min-w-0 flex-1 bg-wiki-bg p-6')}>
					<div className="mx-auto max-w-[1200px]">{children}</div>
				</main>
			</div>
		</div>
	)
}
