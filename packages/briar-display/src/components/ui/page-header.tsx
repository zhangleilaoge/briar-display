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
import { Fragment, type ReactNode } from 'react'

export interface PageHeaderCrumb {
	label: string
	href?: string
}

export interface PageHeaderNavItem {
	label: string
	href: string
	icon?: ReactNode
}

interface PageHeaderProps {
	/** 面包屑（不含首项 xiaobuzi，自动补齐） */
	crumbs?: PageHeaderCrumb[]
	/** 子导航：选中项为藏青 pill */
	nav?: PageHeaderNavItem[]
	currentPath?: string
	/** 自定义子导航（如行情的市场 tab），优先于 nav */
	tabs?: ReactNode
	/** 右侧 UserMenu 之前的附加内容 */
	right?: ReactNode
	/** 替换默认 UserMenu（如加载占位） */
	user?: ReactNode
	/** 子导航同行显示的断点，默认 lg */
	inlineAt?: 'md' | 'lg' | 'xl' | '2xl'
	className?: string
}

/**
 * 全站统一顶栏（以工具箱顶栏为标准）：
 * 左「xiaobuzi > 当前页」面包屑 + 带图标子导航，右侧头像；窄屏子导航独占一行横向滚动。
 */
export function PageHeader({
	crumbs = [],
	nav,
	currentPath,
	tabs,
	right,
	user,
	inlineAt = 'lg',
	className,
}: PageHeaderProps) {
	const navNode =
		tabs ??
		(nav && nav.length > 0 ? (
			<Tabs
				value={currentPath}
				onValueChange={(v) => {
					window.location.href = v
				}}
			>
				<TabsList>
					{nav.map((item) => (
						<TabsTrigger key={item.href} value={item.href} className="gap-1.5">
							{item.icon}
							{item.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		) : null)

	const scroll = 'min-w-0 overflow-x-auto [scrollbar-width:none]'
	const inlineCls = {
		md: `hidden ${scroll} md:block`,
		lg: `hidden ${scroll} lg:block`,
		xl: `hidden ${scroll} xl:block`,
		'2xl': `hidden ${scroll} 2xl:block`,
	}[inlineAt]
	const stackCls = { md: 'md:hidden', lg: 'lg:hidden', xl: 'xl:hidden', '2xl': '2xl:hidden' }[
		inlineAt
	]

	return (
		<header className={`glass-header sticky top-0 z-50 ${className ?? ''}`}>
			<div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
				<div className="flex min-w-0 items-center gap-6">
					<Breadcrumb className="shrink-0 whitespace-nowrap">
						<BreadcrumbList>
							<BreadcrumbItem>
								{crumbs.length === 0 ? (
									<BreadcrumbPage>xiaobuzi</BreadcrumbPage>
								) : (
									<BreadcrumbLink href="/briar/">xiaobuzi</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{crumbs.map((c, i) => (
								<Fragment key={`${c.label}-${i}`}>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										{c.href && i < crumbs.length - 1 ? (
											<BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
										) : (
											<BreadcrumbPage>{c.label}</BreadcrumbPage>
										)}
									</BreadcrumbItem>
								</Fragment>
							))}
						</BreadcrumbList>
					</Breadcrumb>
					{navNode && <div className={inlineCls}>{navNode}</div>}
				</div>
				<div className="flex shrink-0 items-center gap-3">
					{right}
					{user ?? <UserMenu />}
				</div>
			</div>
			{navNode && <div className={`overflow-x-auto px-3 pb-2 ${stackCls}`}>{navNode}</div>}
		</header>
	)
}
