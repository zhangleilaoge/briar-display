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
import { PageHeader } from '@/components/ui/page-header'
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
				className="flex flex-col"
				accent={<GreekColumn className="h-[55vh] w-auto" />}
			>
				<PageHeader crumbs={[{ label: '文件' }]} right={<StorageQuota />} />

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
