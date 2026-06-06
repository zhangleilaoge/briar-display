'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { ChevronDown, History, LogOut, Plus, Shield, Star, User } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface UserInfo {
	name: string
	id?: string
}

function getUser(): UserInfo | null {
	try {
		const raw = localStorage.getItem('briar_user')
		if (!raw) return null
		return JSON.parse(raw) as UserInfo
	} catch {
		return null
	}
}

function getToken(): string | null {
	try {
		return localStorage.getItem('briar_token')
	} catch {
		return null
	}
}

export default function UserMenu() {
	const [open, setOpen] = useState(false)
	const [user, setUser] = useState<UserInfo | null>(null)
	const [token, setToken] = useState<string | null>(null)
	const { roles, isAdmin, hasPermission } = usePermissions()

	useEffect(() => {
		const t = getToken()
		setToken(t)
		if (t) {
			setUser(getUser())
		}
	}, [])

	const handleLogout = useCallback(() => {
		localStorage.removeItem('briar_token')
		localStorage.removeItem('briar_user')
		localStorage.removeItem('briar_permissions')
		window.location.reload()
	}, [])

	// Not logged in
	if (!token) {
		return (
			<Button variant="ghost" asChild>
				<a href="/briar-display/login">
					<User className="mr-1.5 h-3.5 w-3.5" />
					登录
				</a>
			</Button>
		)
	}

	const initial = user?.name?.charAt(0)?.toUpperCase() || 'U'
	const roleDisplay = roles.length > 0 ? roles.map((r) => r.displayName).join(' · ') : null

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] transition-colors hover:bg-wiki-bg-tertiary"
				>
					<span className="flex h-7 w-7 items-center justify-center rounded-full bg-wiki-link text-[12px] font-semibold text-white">
						{initial}
					</span>
					<span className="hidden max-w-[80px] truncate text-wiki-text sm:inline">
						{user?.name || '用户'}
					</span>
					<ChevronDown
						className={cn(
							'h-3.5 w-3.5 text-wiki-text-muted transition-transform',
							open && 'rotate-180',
						)}
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-52 p-1" align="end" sideOffset={4}>
				<div className="border-b border-wiki-border-light px-3 py-2 mb-1">
					<p className="text-[13px] font-medium text-wiki-text">{user?.name || '用户'}</p>
					{roleDisplay && (
						<p className="mt-0.5 flex items-center gap-1 text-[11px] text-wiki-text-muted">
							<Shield className="h-3 w-3" />
							{roleDisplay}
						</p>
					)}
				</div>

				{hasPermission('wiki:page:create') && (
					<a
						href="/briar-display/wiki/new"
						className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
						onClick={() => setOpen(false)}
					>
						<Plus className="h-3.5 w-3.5" />
						新建文章
					</a>
				)}
				<a
					href="/briar-display/wiki/special/user-contributions"
					className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
					onClick={() => setOpen(false)}
				>
					<History className="h-3.5 w-3.5" />
					我的贡献
				</a>
				<a
					href="/briar-display/wiki/special/watchlist"
					className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
					onClick={() => setOpen(false)}
				>
					<Star className="h-3.5 w-3.5" />
					关注列表
				</a>

				{isAdmin && (
					<>
						<div className="my-1 border-t border-wiki-border-light" />
						<a
							href="/briar-display/wiki/special/admin/permissions"
							className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
							onClick={() => setOpen(false)}
						>
							<Shield className="h-3.5 w-3.5" />
							权限管理
						</a>
					</>
				)}

				<div className="my-1 border-t border-wiki-border-light" />

				<button
					type="button"
					onClick={handleLogout}
					className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-highlight hover:text-wiki-link-red"
				>
					<LogOut className="h-3.5 w-3.5" />
					退出登录
				</button>
			</PopoverContent>
		</Popover>
	)
}
