'use client'

import type { FileItem, FolderItem } from '@/api/files'
import { PRIVACY_LOCKED_EVENT, getPrivacyToken } from '@/api/request'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface UsePrivacyGateParams {
	folders: FolderItem[]
	refreshAll: () => void
	setCurrentFolderId: (folderId: string | null) => void
}

/**
 * 隐私空间门禁：隐私链路判定、解锁框编排（待定动作解锁后自动执行）、
 * 403 事件（token 过期/被清）统一弹框
 */
export function usePrivacyGate({ folders, refreshAll, setCurrentFolderId }: UsePrivacyGateParams) {
	const [unlockOpen, setUnlockOpen] = useState(false)
	const [privacyTarget, setPrivacyTarget] = useState<FolderItem | null>(null)
	/** 解锁成功后要执行的待定动作（打开文件夹 / 打开隐私设置框） */
	const pendingActionRef = useRef<(() => void) | null>(null)

	/** 隐私链路文件夹 id 集合（自身或任一祖先 isPrivate），前端拼树计算，与服务端口径一致 */
	const privateChainIds = useMemo(() => {
		const byId = new Map(folders.map((f) => [f.id, f]))
		const result = new Set<string>()
		for (const f of folders) {
			let cur: FolderItem | undefined = f
			while (cur) {
				if (cur.isPrivate) {
					result.add(f.id)
					break
				}
				cur = cur.parentId ? byId.get(cur.parentId) : undefined
			}
		}
		return result
	}, [folders])

	/** 需要解锁的操作：无 token 时先弹解锁框，成功后自动执行原动作 */
	const requireUnlock = useCallback((action: () => void) => {
		if (getPrivacyToken()) {
			action()
			return
		}
		pendingActionRef.current = action
		setUnlockOpen(true)
	}, [])

	const handleUnlocked = useCallback(() => {
		const action = pendingActionRef.current
		pendingActionRef.current = null
		refreshAll()
		action?.()
	}, [refreshAll])

	/** 打开文件夹：隐私链路需先解锁（URL 直达场景由列表 403 事件兜底弹框） */
	const openFolder = useCallback(
		(folderId: string | null) => {
			if (folderId && privateChainIds.has(folderId)) {
				requireUnlock(() => setCurrentFolderId(folderId))
				return
			}
			setCurrentFolderId(folderId)
		},
		[privateChainIds, requireUnlock, setCurrentFolderId],
	)

	/** 文件是否处于隐私链路（决定禁用预览、隐藏「预览/复制链接」） */
	const isPrivateFile = useCallback(
		(file: FileItem) => !!file.folderId && privateChainIds.has(file.folderId),
		[privateChainIds],
	)

	// 隐私链路 403（token 过期/被清）：统一弹解锁框，解锁后原地刷新
	useEffect(() => {
		const handler = () => setUnlockOpen(true)
		window.addEventListener(PRIVACY_LOCKED_EVENT, handler)
		return () => window.removeEventListener(PRIVACY_LOCKED_EVENT, handler)
	}, [])

	return {
		unlockOpen,
		setUnlockOpen,
		privacyTarget,
		setPrivacyTarget,
		privateChainIds,
		requireUnlock,
		handleUnlocked,
		openFolder,
		isPrivateFile,
	}
}
