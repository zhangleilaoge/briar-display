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
import { PermissionProvider } from '@/contexts/PermissionContext'
import type { ReactNode } from 'react'
import StorageQuota from './StorageQuota'

interface FileManagerLayoutProps {
	children: ReactNode
}

export default function FileManagerLayout({ children }: FileManagerLayoutProps) {
	return (
		<PermissionProvider>
			<div className="flex min-h-screen flex-col bg-background">
				<header className="sticky top-0 z-50 border-b bg-background">
					<div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem>
									<BreadcrumbLink href="/briar/">xiaobuzi</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>文件</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
						<div className="flex items-center gap-3">
							<StorageQuota />
							<UserMenu />
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
