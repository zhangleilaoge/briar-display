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
import { HudTitle, ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider } from '@/contexts/PermissionContext'
import type { ReactNode } from 'react'
import StorageQuota from './StorageQuota'

interface FileManagerLayoutProps {
	children: ReactNode
}

export default function FileManagerLayout({ children }: FileManagerLayoutProps) {
	return (
		<PermissionProvider>
			<ThemeShell variant="arcane" className="flex flex-col">
				<header className="glass-header sticky top-0 z-30">
					<div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-2 px-4 sm:px-6">
						<div className="flex items-center gap-6">
							<HudTitle
								index="03"
								label="Fichiers"
								title="文件"
								className="hidden shrink-0 lg:flex"
							/>
							<Breadcrumb className="shrink-0 whitespace-nowrap">
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
						</div>
						<div className="flex items-center gap-3">
							<StorageQuota />
							<UserMenu />
						</div>
					</div>
				</header>

				<main className="flex-1 p-4 sm:p-6">
					<div className="mx-auto max-w-[1200px]">{children}</div>
				</main>
			</ThemeShell>
		</PermissionProvider>
	)
}
