'use client'

/**
 * 全局左侧导航：一串挂在细绳上的行李吊牌，每张吊牌嵌一枚浮雕小图标（自绘 SVG）。
 * 颜色全部来自主题 token（--sidebar-*），在 scrapbook / arcane 下自动切换。
 * md 以下隐藏（移动端保留各页原有顶部导航）。
 */
import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { type ComponentType, type SVGProps, useEffect, useState } from 'react'
import { BowIcon, CameoIcon, FanIcon, InkwellIcon, KeyIcon, RoseIcon, StarIcon } from './ornaments'

interface RibbonItem {
	href: string
	/** 匹配前缀 */
	match: string
	label: string
	caption: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
	adminOnly?: boolean
}

export const RIBBON_ITEMS: RibbonItem[] = [
	{ href: '/briar/', match: '/briar', label: '首页', caption: 'Accueil', icon: BowIcon },
	{
		href: '/briar/tools',
		match: '/briar/tools',
		label: '工具箱',
		caption: 'Outils',
		icon: InkwellIcon,
	},
	{
		href: '/briar/files',
		match: '/briar/files',
		label: '文件',
		caption: 'Fichiers',
		icon: CameoIcon,
	},
	{ href: '/briar/blog/', match: '/briar/blog', label: '博客', caption: 'Journal', icon: FanIcon },
	{
		href: '/briar/markets',
		match: '/briar/markets',
		label: '行情',
		caption: 'Étoiles',
		icon: StarIcon,
	},
	{
		href: '/briar/admin',
		match: '/briar/admin',
		label: '管理',
		caption: 'Clef',
		icon: KeyIcon,
		adminOnly: true,
	},
	{
		href: '/briar/profile',
		match: '/briar/profile',
		label: '个人',
		caption: 'Moi',
		icon: RoseIcon,
	},
]

/** 找出最长前缀匹配的项；首页仅精确匹配 */
export function activeRibbonHref(pathname: string): string | null {
	const path = pathname.replace(/\/+$/, '') || '/'
	let best: RibbonItem | null = null
	for (const item of RIBBON_ITEMS) {
		const hit =
			item.match === '/briar'
				? path === '/briar'
				: path === item.match || path.startsWith(`${item.match}/`)
		if (hit && (!best || item.match.length > best.match.length)) best = item
	}
	return best?.href ?? null
}

const TILTS = [-4, 3, -2, 4, -3, 2, -4]

export interface RibbonSidebarProps {
	className?: string
	/** SSR 时传入当前路径，避免首帧无选中态 */
	currentPath?: string
}

export function RibbonSidebar({ className, currentPath }: RibbonSidebarProps) {
	const { isAdmin } = usePermissions()
	const [path, setPath] = useState(currentPath ?? '')
	// 管理员入口依赖 localStorage 里的登录态，SSR 拿不到；挂载后再显示，避免 hydration 不一致
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setPath(window.location.pathname)
		setMounted(true)
	}, [])

	const active = activeRibbonHref(path)
	const items = RIBBON_ITEMS.filter((item) => !item.adminOnly || (mounted && isAdmin))

	return (
		<nav
			aria-label="全局导航"
			className={cn(
				'fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center border-r border-[color:var(--rv-line)] pt-3 [background-image:var(--sidebar-bg)] backdrop-blur-sm md:flex',
				className,
			)}
		>
			{/* 吊绳 */}
			<span
				aria-hidden
				className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--sidebar-string)]"
			/>
			<span
				aria-hidden
				className="relative mb-2 h-3 w-3 rotate-45 border border-[color:var(--sidebar-tag-stroke)] bg-[var(--sidebar-tag-fill)]"
			/>
			<ul className="relative flex flex-col items-center gap-1.5">
				{items.map((item, i) => {
					const Icon = item.icon
					const isActive = active === item.href
					return (
						<li key={item.href}>
							<a
								href={item.href}
								title={item.label}
								aria-current={isActive ? 'page' : undefined}
								className="rv-ribbon-tag relative flex h-[62px] w-[54px] flex-col items-center outline-none"
								style={{ transform: `rotate(${TILTS[i % TILTS.length]}deg)` }}
							>
								<svg
									viewBox="0 0 48 62"
									preserveAspectRatio="none"
									className="absolute inset-0 h-full w-full drop-shadow-[0_2px_3px_rgba(28,43,75,0.18)]"
									aria-hidden
								>
									<path d="M24 0v8" stroke="var(--sidebar-string)" strokeWidth="1" />
									<path
										className="rv-tag-shape"
										strokeWidth="1"
										d="M14 8h20l10 10v40a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V18Z"
									/>
									<path
										d="M14 11h20l7 7.4V56a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V18.4Z"
										fill="none"
										stroke="var(--sidebar-tag-stroke)"
										strokeOpacity=".35"
										strokeDasharray="1.5 2"
									/>
									<circle cx="24" cy="15" r="2.2" fill="none" stroke="var(--sidebar-tag-stroke)" />
								</svg>
								<Icon className="rv-tag-icon rv-cameo relative mt-[22px] h-[22px] w-[22px]" />
								<span className="rv-tag-label relative mt-0.5 font-label text-[7px] uppercase tracking-[0.04em] text-[color:var(--sidebar-icon)]">
									{item.caption}
								</span>
								<span className="sr-only">{item.label}</span>
							</a>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}

export default RibbonSidebar
