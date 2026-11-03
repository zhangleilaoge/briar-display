'use client'

import { getPreference, putPreference } from '@/api/users'
import { usePermissions } from '@/contexts/PermissionContext'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { readRibbonLockCache, writeRibbonLockCache } from './ribbonLockCache'

const PREFERENCE_KEY = 'ribbon-locked'
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function useRibbonLock() {
	const { isLoggedIn, loading, user } = usePermissions()
	const [locked, setLocked] = useState(false)
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const lockedRef = useRef(false)
	const savedLockedRef = useRef(false)
	const revisionRef = useRef(0)
	const writeQueueRef = useRef<Promise<void>>(Promise.resolve())

	const replaceLocked = useCallback((next: boolean) => {
		lockedRef.current = next
		setLocked(next)
	}, [])

	useIsomorphicLayoutEffect(() => {
		const cached = readRibbonLockCache(window.localStorage)
		if (cached === null) return
		savedLockedRef.current = cached
		replaceLocked(cached)
	}, [replaceLocked])

	useEffect(() => {
		let active = true
		const revision = ++revisionRef.current
		if (loading) {
			setStatus('loading')
			return () => {
				active = false
			}
		}
		if (!isLoggedIn || !user?.id) {
			savedLockedRef.current = false
			replaceLocked(false)
			setStatus('ready')
			return () => {
				active = false
			}
		}

		setStatus('loading')
		getPreference<unknown>(PREFERENCE_KEY)
			.then((response) => {
				if (!response.success) throw new Error(response.message)
				const next = response.data?.value === true
				if (!active || revisionRef.current !== revision) return
				writeRibbonLockCache(window.localStorage, user.id, next)
				savedLockedRef.current = next
				replaceLocked(next)
				setStatus('ready')
			})
			.catch(() => {
				if (!active || revisionRef.current !== revision) return
				setStatus('error')
				toast.error('侧栏固定设置读取失败，请刷新后重试')
			})
		return () => {
			active = false
		}
	}, [isLoggedIn, loading, replaceLocked, user?.id])

	const toggleLocked = useCallback(() => {
		if (status !== 'ready' || !isLoggedIn || !user?.id) return
		const next = !lockedRef.current
		const revision = ++revisionRef.current
		writeRibbonLockCache(window.localStorage, user.id, next)
		replaceLocked(next)
		writeQueueRef.current = writeQueueRef.current
			.catch(() => undefined)
			.then(async () => {
				try {
					const response = await putPreference(PREFERENCE_KEY, next)
					if (!response.success) throw new Error(response.message)
					savedLockedRef.current = next
				} catch {
					if (revisionRef.current === revision) {
						writeRibbonLockCache(window.localStorage, user.id, savedLockedRef.current)
						replaceLocked(savedLockedRef.current)
						toast.error('侧栏固定设置保存失败，请重试')
					}
				}
			})
	}, [isLoggedIn, replaceLocked, status, user?.id])

	return {
		locked,
		canLock: status === 'ready' && isLoggedIn && Boolean(user?.id),
		toggleLocked,
	}
}
