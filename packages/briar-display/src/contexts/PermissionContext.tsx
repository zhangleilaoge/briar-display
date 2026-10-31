'use client'

import { getMyPermissions } from '@/api/admin'
import { Toaster } from '@/components/ui/sonner'
import { ensureDevAdminSession } from '@/lib/devAdminAuth'
import type { Role, UserWithRoles } from '@briar/shared'
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useState,
} from 'react'

interface PermissionContextValue {
	permissions: string[]
	roles: Role[]
	user: UserWithRoles | null
	loading: boolean
	isLoggedIn: boolean
	hasPermission: (code: string) => boolean
	hasAnyPermission: (codes: string[]) => boolean
	isAdmin: boolean
	refresh: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

const isBrowser = () => typeof window !== 'undefined'
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function syncUserToStorage(user: UserWithRoles | null) {
	if (!isBrowser()) return
	if (user) {
		localStorage.setItem(
			'briar_user',
			JSON.stringify({
				name: user.name,
				email: user.email,
				avatar: user.avatar,
				id: user.id,
				isAdmin: user.roles?.some((r) => r.name === 'admin') ?? false,
			}),
		)
	}
}

/** 首帧乐观值：用上次缓存的 isAdmin 避免入口卡片/菜单项等请求回来后才弹出（仅 loading 期间生效，请求回来以服务端为准） */
const readCachedIsAdmin = (): boolean => {
	if (!isBrowser()) return false
	if (!localStorage.getItem('briar_token')) return false // 未登录不乐观展示
	try {
		const raw = localStorage.getItem('briar_user')
		return raw ? JSON.parse(raw).isAdmin === true : false
	} catch {
		return false
	}
}

/**
 * 权限上下文。外壳（AdminShell / ToolsLayout 等）与各页都可能包一层；
 * 嵌套时复用外层，避免叠两个 Toaster 导致同一条 toast 弹两次。
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
	const parent = useContext(PermissionContext)
	if (parent) {
		return <>{children}</>
	}
	return <PermissionProviderRoot>{children}</PermissionProviderRoot>
}

function PermissionProviderRoot({ children }: { children: ReactNode }) {
	const [permissions, setPermissions] = useState<string[]>([])
	const [roles, setRoles] = useState<Role[]>([])
	const [user, setUser] = useState<UserWithRoles | null>(null)
	const [loading, setLoading] = useState(true)
	const [isLoggedIn, setIsLoggedIn] = useState(false)
	// 首帧必须与 SSR 一致（false），否则会触发 hydration mismatch；
	// 在 layout effect（绘制前）读取缓存，仍可避免入口卡片“弹出”闪烁
	const [cachedIsAdmin, setCachedIsAdmin] = useState(false)
	useIsomorphicLayoutEffect(() => {
		setCachedIsAdmin(readCachedIsAdmin())
	}, [])

	const fetchPermissions = useCallback(async () => {
		if (!isBrowser()) {
			setLoading(false)
			return
		}

		await ensureDevAdminSession()
		const token = localStorage.getItem('briar_token')
		if (!token) {
			setPermissions([])
			setRoles([])
			setUser(null)
			setIsLoggedIn(false)
			setLoading(false)
			return
		}

		try {
			setLoading(true)
			setIsLoggedIn(true)
			const res = await getMyPermissions()
			if (res.success && res.data) {
				setPermissions(res.data.permissions)
				setRoles(res.data.roles)
				setUser(res.data)
				syncUserToStorage(res.data)
			}
		} catch (err) {
			console.error('Failed to fetch permissions:', err)
			setPermissions([])
			setRoles([])
			setUser(null)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchPermissions()
	}, [fetchPermissions])

	useEffect(() => {
		if (!isBrowser()) return
		const handleStorage = (e: StorageEvent) => {
			if (e.key === 'briar_token') {
				fetchPermissions()
			}
		}
		window.addEventListener('storage', handleStorage)
		return () => window.removeEventListener('storage', handleStorage)
	}, [fetchPermissions])

	const hasPermission = useCallback((code: string) => permissions.includes(code), [permissions])

	const hasAnyPermission = useCallback(
		(codes: string[]) => codes.some((code) => permissions.includes(code)),
		[permissions],
	)

	// loading 期间用上次缓存的 isAdmin 乐观展示；请求回来以服务端角色为准（降级用户会被纠正）
	const isAdmin = roles.some((r) => r.name === 'admin') || (loading && cachedIsAdmin)

	const value: PermissionContextValue = {
		permissions,
		roles,
		user,
		loading,
		isLoggedIn,
		hasPermission,
		hasAnyPermission,
		isAdmin,
		refresh: fetchPermissions,
	}

	return (
		<PermissionContext.Provider value={value}>
			{children}
			<Toaster position="top-center" richColors />
		</PermissionContext.Provider>
	)
}

export function usePermissions(): PermissionContextValue {
	const ctx = useContext(PermissionContext)
	if (!ctx) {
		return {
			permissions: [],
			roles: [],
			user: null,
			loading: false,
			isLoggedIn: isBrowser() ? !!localStorage.getItem('briar_token') : false,
			hasPermission: () => false,
			hasAnyPermission: () => false,
			isAdmin: false,
			refresh: async () => {},
		}
	}
	return ctx
}
