'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePermissions } from '@/contexts/PermissionContext'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { cn } from '@/lib/utils'
import { ChevronDown, Home, LogIn, LogOut, Mail, Shield, User as UserIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface StoredUser {
	name: string
	email?: string
	avatar?: string
	id?: string
}

function getStoredUser(): StoredUser | null {
	try {
		const raw = localStorage.getItem('briar_user')
		if (!raw) return null
		return JSON.parse(raw) as StoredUser
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

interface UserMenuProps {
	/** 主题：light 给 Portal/Tools/Images/Admin，wiki 给 Wiki 主题顶部 */
	variant?: 'light' | 'wiki'
}

function Avatar({
	url,
	initial,
	className,
	alt,
}: {
	url?: string
	initial: string
	className: string
	alt?: string
}) {
	const [failed, setFailed] = useState(false)

	if (url && !failed) {
		return (
			<img
				src={url}
				alt={alt || 'avatar'}
				className={`${className} object-cover`}
				onError={() => setFailed(true)}
			/>
		)
	}
	return <span className={className}>{initial}</span>
}

export default function UserMenu({ variant = 'light' }: UserMenuProps) {
	const [open, setOpen] = useState(false)
	const [user, setUser] = useState<StoredUser | null>(null)
	const [token, setToken] = useState<string | null>(null)
	const { roles, isAdmin, isLoggedIn } = usePermissions()
	const { unread } = useUnreadMessages()

	useEffect(() => {
		const t = getToken()
		setToken(t)
		if (t) setUser(getStoredUser())
	}, [])

	// 跨标签页登录/登出同步
	useEffect(() => {
		const onStorage = (e: StorageEvent) => {
			if (e.key === 'briar_token') {
				const t = getToken()
				setToken(t)
				setUser(t ? getStoredUser() : null)
			}
			if (e.key === 'briar_user') {
				setUser(getStoredUser())
			}
		}
		window.addEventListener('storage', onStorage)
		return () => window.removeEventListener('storage', onStorage)
	}, [])

	const handleLogout = useCallback(() => {
		localStorage.removeItem('briar_token')
		localStorage.removeItem('briar_user')
		localStorage.removeItem('briar_permissions')
		window.location.href = '/briar/'
	}, [])

	const isLight = variant === 'light'
	const initial = user?.name?.charAt(0)?.toUpperCase() || 'U'
	const roleDisplay = roles.length > 0 ? roles.map((r) => r.displayName).join(' · ') : null

	// 触发器样式（区分主题）
	const triggerClass = cn(
		'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
		isLight
			? 'text-foreground hover:bg-accent'
			: 'text-wiki-text hover:bg-wiki-bg-tertiary text-[13px]',
	)
	const avatarClass = cn(
		'flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold text-white',
		isLight ? 'bg-gradient-to-br from-blue-500 to-purple-500' : 'bg-wiki-link',
	)
	const nameClass = cn(
		'hidden max-w-[80px] truncate sm:inline',
		isLight ? 'text-foreground' : 'text-wiki-text text-[13px]',
	)
	const chevronClass = cn(
		'h-3.5 w-3.5 transition-transform',
		isLight ? 'text-muted-foreground' : 'text-wiki-text-muted',
		open && 'rotate-180',
	)

	// 菜单项样式
	const itemClass = cn(
		'flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors',
		isLight
			? 'text-foreground hover:bg-accent'
			: 'text-wiki-text-secondary hover:bg-wiki-bg-tertiary hover:text-wiki-text text-[13px]',
	)
	const destructiveItemClass = cn(
		'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors',
		isLight
			? 'text-destructive hover:bg-destructive/10'
			: 'text-wiki-text-secondary hover:bg-wiki-highlight hover:text-wiki-link-red text-[13px]',
	)

	// 未登录：直接显示「登录」按钮
	if (!token || !isLoggedIn) {
		return (
			<a
				href="/briar/login"
				className={cn(
					'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
					isLight
						? 'border border-border bg-background text-foreground hover:bg-accent'
						: 'text-wiki-text hover:bg-wiki-bg-tertiary text-[13px]',
				)}
			>
				<LogIn className="h-3.5 w-3.5" />
				登录
			</a>
		)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button type="button" className={triggerClass} aria-label="用户菜单">
					<span className="relative">
						<Avatar url={user?.avatar} initial={initial} className={avatarClass} />
						{unread > 0 && (
							<span className="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full bg-red-500" />
						)}
					</span>
					<span className={nameClass}>{user?.name || '用户'}</span>
					<ChevronDown className={chevronClass} />
				</button>
			</PopoverTrigger>
			<PopoverContent
				className={cn('w-56 p-1', isLight && 'bg-popover')}
				align="end"
				sideOffset={6}
			>
				{/* 头部：用户信息 */}
				<div
					className={cn(
						'border-b px-3 py-2 mb-1',
						isLight ? 'border-border' : 'border-wiki-border-light',
					)}
				>
					{/* 名字与角色 */}
					<div className="flex items-center justify-between gap-2">
						<p
							className={cn(
								'truncate text-sm font-medium',
								isLight ? 'text-foreground' : 'text-wiki-text',
							)}
						>
							{user?.name || '用户'}
						</p>
						{roleDisplay && (
							<span
								className={cn(
									'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]',
									isLight ? 'bg-primary/10 text-primary' : 'bg-wiki-link/10 text-wiki-link',
								)}
								title={roleDisplay}
							>
								<Shield className="h-3 w-3" />
								{roleDisplay}
							</span>
						)}
					</div>

					{/* 邮箱独占一行，避免被角色压缩 */}
					{user?.email && (
						<p
							className={cn(
								'mt-0.5 truncate text-[11px]',
								isLight ? 'text-muted-foreground' : 'text-wiki-text-muted',
							)}
						>
							{user.email}
						</p>
					)}
				</div>

				{/* 菜单项 */}
				<a href="/briar/profile" className={itemClass} onClick={() => setOpen(false)}>
					<UserIcon className="h-3.5 w-3.5" />
					个人中心
				</a>
				<a
					href="/briar/profile?tab=messages"
					className={cn(itemClass, 'justify-between')}
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
				<a href="/briar/" className={itemClass} onClick={() => setOpen(false)}>
					<Home className="h-3.5 w-3.5" />
					回到主页
				</a>
				{isAdmin && (
					<a href="/briar/admin/permissions" className={itemClass} onClick={() => setOpen(false)}>
						<Shield className="h-3.5 w-3.5" />
						管理后台
					</a>
				)}

				<div
					className={cn('my-1 border-t', isLight ? 'border-border' : 'border-wiki-border-light')}
				/>

				<button type="button" onClick={handleLogout} className={destructiveItemClass}>
					<LogOut className="h-3.5 w-3.5" />
					退出登录
				</button>
			</PopoverContent>
		</Popover>
	)
}
