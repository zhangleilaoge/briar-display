'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { WikiButton as Button } from '@/components/wiki/common/ui/button'
import { usePermissions } from '@/contexts/PermissionContext'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { cn } from '@/lib/utils'
import { ChevronDown, History, Home, LogOut, Mail, Plus, Shield, Star, User } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface UserInfo {
	name: string
	id?: string
	avatar?: string
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

function Avatar({ url, initial }: { url?: string; initial: string }) {
	const [failed, setFailed] = useState(false)
	if (url && !failed) {
		return (
			<img
				src={url}
				alt="avatar"
				className="flex h-7 w-7 items-center justify-center rounded-full bg-wiki-link object-cover text-[12px] font-semibold text-white"
				onError={() => setFailed(true)}
			/>
		)
	}
	return (
		<span className="flex h-7 w-7 items-center justify-center rounded-full bg-wiki-link text-[12px] font-semibold text-white">
			{initial}
		</span>
	)
}

export default function UserMenu() {
	const [open, setOpen] = useState(false)
	const [user, setUser] = useState<UserInfo | null>(null)
	const [token, setToken] = useState<string | null>(null)
	const { roles, isAdmin, hasPermission } = usePermissions()
	const { unread } = useUnreadMessages()

	useEffect(() => {
		const t = getToken()
		setToken(t)
		if (t) {
			setUser(getUser())
		}
	}, [])

	useEffect(() => {
		const onStorage = (e: StorageEvent) => {
			if (e.key === 'briar_token') {
				const t = getToken()
				setToken(t)
				setUser(t ? getUser() : null)
			}
			if (e.key === 'briar_user') {
				setUser(getUser())
			}
		}
		window.addEventListener('storage', onStorage)
		return () => window.removeEventListener('storage', onStorage)
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
			<a
				href="/briar/login"
				className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] text-wiki-text transition-colors hover:bg-wiki-bg-tertiary"
			>
				<User className="h-3.5 w-3.5" />
				登录
			</a>
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
					<span className="relative">
						<Avatar url={user?.avatar} initial={initial} />
						{unread > 0 && (
							<span className="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full bg-red-500" />
						)}
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
			<PopoverContent className="w-56 p-1" align="end" sideOffset={4}>
				<div className="flex items-center justify-between gap-2 border-b border-wiki-border-light px-3 py-2 mb-1">
					<div className="min-w-0 flex-1">
						<p className="truncate text-[13px] font-medium text-wiki-text">
							{user?.name || '用户'}
						</p>
					</div>
					{roleDisplay && (
						<span
							className="inline-flex shrink-0 items-center gap-1 rounded bg-wiki-link/10 px-1.5 py-0.5 text-[11px] text-wiki-link"
							title={roleDisplay}
						>
							<Shield className="h-3 w-3" />
							{roleDisplay}
						</span>
					)}
				</div>

				<a
					href="/briar/profile"
					className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
					onClick={() => setOpen(false)}
				>
					<User className="h-3.5 w-3.5" />
					个人中心
				</a>
				<a
					href="/briar/profile?tab=messages"
					className="flex items-center justify-between gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
					onClick={() => setOpen(false)}
				>
					<span className="flex items-center gap-2">
						<Mail className="h-3.5 w-3.5" />
						站内信
					</span>
					{unread > 0 && (
						<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
							{unread > 99 ? '99+' : unread}
						</span>
					)}
				</a>
				<a
					href="/briar/"
					className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
					onClick={() => setOpen(false)}
				>
					<Home className="h-3.5 w-3.5" />
					回到主页
				</a>

				<div className="my-1 border-t border-wiki-border-light" />

				{hasPermission('wiki:page:create') && (
					<a
						href="/briar/wiki/new"
						className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
						onClick={() => setOpen(false)}
					>
						<Plus className="h-3.5 w-3.5" />
						新建文章
					</a>
				)}
				<a
					href="/briar/wiki/special/user-contributions"
					className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
					onClick={() => setOpen(false)}
				>
					<History className="h-3.5 w-3.5" />
					我的贡献
				</a>
				<a
					href="/briar/wiki/special/watchlist"
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
							href="/briar/admin/permissions"
							className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
							onClick={() => setOpen(false)}
						>
							<Shield className="h-3.5 w-3.5" />
							管理后台
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
