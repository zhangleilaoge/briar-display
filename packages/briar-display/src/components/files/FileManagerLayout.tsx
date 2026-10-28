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
import { GreekColumn } from '@/components/ui/ornaments'
import { HudTitle, PaperPanel, ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider } from '@/contexts/PermissionContext'
import type { ReactNode } from 'react'
import StorageQuota from './StorageQuota'

interface FileManagerLayoutProps {
	children: ReactNode
}

export default function FileManagerLayout({ children }: FileManagerLayoutProps) {
	return (
		<PermissionProvider>
			<ThemeShell
				variant="arcane"
				watermark="03"
				glyph="档"
				className="flex flex-col"
				accent={<GreekColumn className="h-[55vh] w-auto" />}
			>
				<header className="glass-header sticky top-0 z-30">
					<div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-2 px-4 sm:px-6">
						<div className="flex items-center gap-6">
							<HudTitle
								index="03"
								label="Fichiers"
								title="文件"
								script="Chercher dans le ciel"
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
					<div className="mx-auto max-w-[1200px]">
						<PaperPanel index="01" title="RÉSULTATS · 档案柜">
							{children}
						</PaperPanel>
					</div>
				</main>
			</ThemeShell>
		</PermissionProvider>
	)
}
