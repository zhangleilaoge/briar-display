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
import { HudTitle, ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { MARKET_IDS, MARKET_LABELS, type MarketId } from '@briar/shared'
import type { ReactNode } from 'react'

interface MarketsShellProps {
	children: ReactNode
	/** 当前市场；概览页不传 */
	market?: MarketId
}

/** 行情页面外壳：与工具箱同款 Arcane HUD 外壳，详情页带市场切换 tab */
export default function MarketsShell({ children, market }: MarketsShellProps) {
	const tabs = market ? (
		<Tabs
			value={market}
			onValueChange={(v) => {
				window.location.href = `/briar/markets/${v}`
			}}
		>
			<TabsList>
				{MARKET_IDS.map((id) => (
					<TabsTrigger key={id} value={id}>
						{MARKET_LABELS[id]}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	) : null

	return (
		<PermissionProvider>
			<ThemeShell variant="arcane" className="flex flex-col">
				<header className="glass-header sticky top-0 z-50">
					<div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
						<div className="flex min-w-0 items-center gap-6">
							<HudTitle
								index="05"
								label="Étoiles"
								title="行情"
								className="hidden shrink-0 2xl:flex"
							/>
							<Breadcrumb className="shrink-0 whitespace-nowrap">
								<BreadcrumbList>
									<BreadcrumbItem>
										<BreadcrumbLink href="/briar/">xiaobuzi</BreadcrumbLink>
									</BreadcrumbItem>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										{market ? (
											<BreadcrumbLink href="/briar/markets">行情</BreadcrumbLink>
										) : (
											<BreadcrumbPage>行情</BreadcrumbPage>
										)}
									</BreadcrumbItem>
									{market && (
										<>
											<BreadcrumbSeparator />
											<BreadcrumbItem>
												<BreadcrumbPage>{MARKET_LABELS[market]}</BreadcrumbPage>
											</BreadcrumbItem>
										</>
									)}
								</BreadcrumbList>
							</Breadcrumb>
							{tabs && <div className="hidden md:block">{tabs}</div>}
						</div>
						<div className="shrink-0">
							<UserMenu />
						</div>
					</div>
					{tabs && <div className="overflow-x-auto px-3 pb-2 md:hidden">{tabs}</div>}
				</header>
				<main className="flex-1 p-4 sm:p-6">
					<div className="mx-auto w-full max-w-6xl">{children}</div>
				</main>
			</ThemeShell>
		</PermissionProvider>
	)
}
