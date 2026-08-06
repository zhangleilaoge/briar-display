'use client'

import { getUnreadCount } from '@/api/messages'
import { usePermissions } from '@/contexts/PermissionContext'
import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL = 60_000

/** 站内信未读数（登录时 60s 轮询） */
export function useUnreadMessages() {
	const { isLoggedIn } = usePermissions()
	const [unread, setUnread] = useState(0)

	const refresh = useCallback(async () => {
		try {
			const res = await getUnreadCount()
			if (res.success && res.data) setUnread(res.data.count)
		} catch {
			/* 网络异常静默，下轮轮询再试 */
		}
	}, [])

	useEffect(() => {
		if (!isLoggedIn) {
			setUnread(0)
			return
		}
		refresh()
		const timer = setInterval(refresh, POLL_INTERVAL)
		return () => clearInterval(timer)
	}, [isLoggedIn, refresh])

	return { unread, refresh }
}
