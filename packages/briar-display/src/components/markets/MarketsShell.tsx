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
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaperPanel, ThemeShell } from '@/components/ui/theme-shell'
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
				<PageHeader
					crumbs={[
						{ label: '行情', href: '/briar/markets' },
						...(market ? [{ label: MARKET_LABELS[market] }] : []),
					]}
					tabs={tabs ?? undefined}
					inlineAt="md"
				/>
				<main className="rv-content-inset flex-1 p-4 sm:p-6">
					<div className="mx-auto w-full max-w-6xl">
						<PaperPanel title="MARCHÉ · 星图">{children}</PaperPanel>
					</div>
				</main>
			</ThemeShell>
		</PermissionProvider>
	)
}
