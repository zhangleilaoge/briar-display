'use client'

import UserMenu from '@/components/common/UserMenu'
import { Button } from '@/components/ui/button'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { ImageIcon, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import StorageQuota from './StorageQuota'

interface NavItem {
	label: string
	href: string
	icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
	{ label: '上传', href: '/briar-display/images/upload', icon: <Upload className="h-4 w-4" /> },
	{ label: '相册', href: '/briar-display/images/gallery', icon: <ImageIcon className="h-4 w-4" /> },
]

interface ImageHostingLayoutProps {
	children: ReactNode
	currentPath: string
}

export default function ImageHostingLayout({ children, currentPath }: ImageHostingLayoutProps) {
	return (
		<PermissionProvider>
			<div className="flex min-h-screen flex-col bg-background">
				<header className="sticky top-0 z-50 border-b bg-background">
					<div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
						<div className="flex items-center gap-6">
							<a
								href="/briar-display/"
								className="text-sm font-semibold text-foreground no-underline"
							>
								Briar
							</a>
							<span className="text-sm text-muted-foreground">/ 图床</span>
							<nav className="flex items-center gap-1">
								{NAV_ITEMS.map((item) => {
									const isActive = currentPath === item.href
									return (
										<a key={item.href} href={item.href}>
											<Button
												variant="ghost"
												size="sm"
												className={cn('gap-1.5', isActive && 'bg-accent font-medium')}
											>
												{item.icon}
												{item.label}
											</Button>
										</a>
									)
								})}
							</nav>
						</div>
						<div className="flex items-center gap-3">
							<StorageQuota />
							<UserMenu variant="light" />
						</div>
					</div>
				</header>

				<main className="flex-1 p-6">
					<div className="mx-auto max-w-[1200px]">{children}</div>
				</main>
			</div>
		</PermissionProvider>
	)
}
