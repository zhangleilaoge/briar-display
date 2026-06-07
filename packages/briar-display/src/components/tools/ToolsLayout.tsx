'use client'

import type { ReactNode } from 'react'
import ToolsNav from './ToolsNav'

interface ToolsLayoutProps {
	children: ReactNode
	currentPath: string
	title?: string
}

export default function ToolsLayout({ children, currentPath, title }: ToolsLayoutProps) {
	return (
		<div className="flex min-h-screen flex-col bg-background">
			{/* 顶部栏 */}
			<header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-6">
				<div className="flex items-center gap-3">
					<a
						href="/briar-display/tools/diff"
						className="text-sm font-semibold text-foreground hover:text-primary"
					>
						Briar 工具箱
					</a>
					{title && (
						<>
							<span className="text-muted-foreground">/</span>
							<span className="text-sm text-muted-foreground">{title}</span>
						</>
					)}
				</div>
				<a
					href="/briar-display/wiki/"
					className="text-sm text-muted-foreground hover:text-foreground hover:underline"
				>
					← 返回 Wiki
				</a>
			</header>

			<div className="flex flex-1">
				{/* 侧栏 */}
				<aside className="sticky top-12 hidden w-[180px] shrink-0 border-r p-4 md:block">
					<ToolsNav currentPath={currentPath} />
				</aside>

				{/* 内容区 */}
				<main className="flex-1 p-6">
					<div className="mx-auto max-w-[1200px]">{children}</div>
				</main>
			</div>
		</div>
	)
}
