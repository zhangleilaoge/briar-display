'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Shield, Users } from 'lucide-react'

interface NavItem {
	label: string
	href: string
	icon: React.ReactNode
	permission?: string
}

const NAV_ITEMS: NavItem[] = [
	{
		label: '权限管理',
		href: '/briar-display/admin/permissions',
		icon: <Shield className="h-4 w-4" />,
		permission: 'admin:role:manage',
	},
	{
		label: '用户角色',
		href: '/briar-display/admin/users',
		icon: <Users className="h-4 w-4" />,
		permission: 'admin:user-role:assign',
	},
]

interface AdminNavProps {
	currentPath: string
}

export default function AdminNav({ currentPath }: AdminNavProps) {
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
