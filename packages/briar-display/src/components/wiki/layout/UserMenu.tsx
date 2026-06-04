'use client'

import { cn } from '@/lib/utils'
import { ChevronDown, History, LogOut, Plus, Star, User } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

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
	const menuRef = useRef<HTMLDivElement>(null)

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
		window.location.reload()
	}, [])

	// Close on outside click
	useEffect(() => {
		if (!open) return
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClick)
		return () => document.removeEventListener('mousedown', handleClick)
	}, [open])

	// Not logged in
	if (!token) {
		return (
			<a
				href="/briar-display/login"
				className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium text-wiki-link transition-colors hover:bg-wiki-bg-tertiary"
			>
				<User className="h-3.5 w-3.5" />
				登录
			</a>
		)
	}

	const initial = user?.name?.charAt(0)?.toUpperCase() || 'U'

	return (
		<div ref={menuRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] transition-colors hover:bg-wiki-bg-tertiary"
			>
				<span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3366cc] text-[12px] font-semibold text-white">
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

			{open && (
				<div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-wiki-border-light bg-wiki-bg py-1 shadow-lg">
					<div className="border-b border-wiki-border-light px-3 py-2">
						<p className="text-[13px] font-medium text-wiki-text">{user?.name || '用户'}</p>
					</div>

					<a
						href="/briar-display/wiki/new"
						className="flex items-center gap-2 px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
						onClick={() => setOpen(false)}
					>
						<Plus className="h-3.5 w-3.5" />
						新建文章
					</a>
					<a
						href="/briar-display/wiki/special/user-contributions"
						className="flex items-center gap-2 px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
						onClick={() => setOpen(false)}
					>
						<History className="h-3.5 w-3.5" />
						我的贡献
					</a>
					<a
						href="/briar-display/wiki/special/watchlist"
						className="flex items-center gap-2 px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-bg-tertiary hover:text-wiki-text"
						onClick={() => setOpen(false)}
					>
						<Star className="h-3.5 w-3.5" />
						关注列表
					</a>

					<div className="my-1 border-t border-wiki-border-light" />

					<button
						type="button"
						onClick={handleLogout}
						className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-wiki-text-secondary transition-colors hover:bg-wiki-highlight hover:text-[#ba0000]"
					>
						<LogOut className="h-3.5 w-3.5" />
						退出登录
					</button>
				</div>
			)}
		</div>
	)
}
