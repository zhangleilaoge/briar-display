'use client'

import { getMyPermissions } from '@/api/admin'
import type { Role, UserWithRoles } from '@briar/shared'
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react'

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

export function PermissionProvider({ children }: { children: ReactNode }) {
	const [permissions, setPermissions] = useState<string[]>([])
	const [roles, setRoles] = useState<Role[]>([])
	const [user, setUser] = useState<UserWithRoles | null>(null)
	const [loading, setLoading] = useState(true)
	const [isLoggedIn, setIsLoggedIn] = useState(false)

	const fetchPermissions = useCallback(async () => {
		if (!isBrowser()) {
			setLoading(false)
			return
		}

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

	const isAdmin = roles.some((r) => r.name === 'admin')

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

	return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
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
