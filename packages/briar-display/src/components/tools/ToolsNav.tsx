'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FileDiff, ImageIcon } from 'lucide-react'

interface NavItem {
	label: string
	href: string
	icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
	{
		label: '文件 Diff',
		href: '/briar-display/tools/diff',
		icon: <FileDiff className="h-4 w-4" />,
	},
	{
		label: '图片压缩',
		href: '/briar-display/tools/compress',
		icon: <ImageIcon className="h-4 w-4" />,
	},
]

interface ToolsNavProps {
	currentPath: string
}

export default function ToolsNav({ currentPath }: ToolsNavProps) {
	return (
		<nav className="space-y-1">
			{NAV_ITEMS.map((item) => {
				const isActive = currentPath === item.href
				return (
					<a key={item.href} href={item.href} className="block">
						<Button
							variant="ghost"
							className={cn(
								'w-full justify-start gap-2 text-sm',
								isActive && 'bg-accent text-accent-foreground font-medium',
							)}
						>
							{item.icon}
							{item.label}
						</Button>
					</a>
				)
			})}
		</nav>
	)
}
