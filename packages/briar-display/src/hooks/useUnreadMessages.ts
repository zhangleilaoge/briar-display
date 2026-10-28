'use client'

import { MESSAGES_CHANGED_EVENT, getUnreadCount } from '@/api/messages'
import { usePermissions } from '@/contexts/PermissionContext'
import { useCallback, useEffect, useState } from 'react'

const POLL_INTERVAL = 60_000

/** 站内信未读数（登录时 60s 轮询；站内信已读/删除后即时刷新） */
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
		window.addEventListener(MESSAGES_CHANGED_EVENT, refresh)
		return () => {
			clearInterval(timer)
			window.removeEventListener(MESSAGES_CHANGED_EVENT, refresh)
		}
	}, [isLoggedIn, refresh])

	return { unread, refresh }
}
