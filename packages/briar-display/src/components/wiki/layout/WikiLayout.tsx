'use client'

import WikiSidebar from '@/components/wiki/layout/WikiSidebar'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'

interface WikiLayoutProps {
	children: ReactNode
	title?: string
	showSidebar?: boolean
	activeTab?: string
	slug?: string
	className?: string
}

export default function WikiLayout({
	children,
	title,
	showSidebar = true,
	className,
}: WikiLayoutProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false)

	return (
		<div className={cn('min-h-screen bg-[#f6f6f6]', className)}>
			{/* Mobile sidebar toggle */}
			{showSidebar && (
				<div className="fixed left-0 top-0 z-40 lg:hidden">
					<button
						type="button"
						onClick={() => setSidebarOpen(!sidebarOpen)}
						className="m-2 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-white text-foreground shadow-sm transition-colors hover:bg-muted"
						aria-label={sidebarOpen ? '关闭侧栏' : '打开侧栏'}
					>
						{sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			)}

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

			<div className="mx-auto flex max-w-[1400px]">
				{/* Sidebar */}
				{showSidebar && (
					<aside
						className={cn(
							'fixed left-0 top-0 z-30 h-full w-[250px] overflow-y-auto border-r border-border bg-white px-3 py-16 transition-transform lg:sticky lg:top-0 lg:block lg:translate-x-0 lg:py-4',
							sidebarOpen ? 'translate-x-0' : '-translate-x-full',
						)}
					>
						<WikiSidebar />
					</aside>
				)}

				{/* Main content */}
				<main className={cn('min-w-0 flex-1', showSidebar && 'lg:ml-0')}>
					<div className="mx-auto max-w-[960px] px-4 py-6 lg:px-8">
						{title && (
							<h1 className="mb-4 border-b border-border pb-2 font-serif text-2xl font-normal text-foreground">
								{title}
							</h1>
						)}
						<div className="rounded-sm border border-border/50 bg-white p-6 shadow-sm">
							{children}
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
