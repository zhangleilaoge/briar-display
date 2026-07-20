'use client'

import UserMenu from '@/components/common/UserMenu'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionProvider } from '@/contexts/PermissionContext'
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
							<Breadcrumb>
								<BreadcrumbList>
									<BreadcrumbItem>
										<BreadcrumbLink href="/briar-display/">Briar</BreadcrumbLink>
									</BreadcrumbItem>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										<BreadcrumbPage>图床</BreadcrumbPage>
									</BreadcrumbItem>
								</BreadcrumbList>
							</Breadcrumb>
							<Tabs
								value={currentPath}
								onValueChange={(v) => {
									window.location.href = v
								}}
							>
								<TabsList>
									{NAV_ITEMS.map((item) => (
										<TabsTrigger key={item.href} value={item.href} className="gap-1.5">
											{item.icon}
											{item.label}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
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
