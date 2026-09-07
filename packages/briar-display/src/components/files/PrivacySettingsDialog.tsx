'use client'

import { type FolderItem, setFolderPrivacy } from '@/api/files'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface PrivacySettingsDialogProps {
	/** 目标文件夹（null 关闭）。调用方需确保已持有解锁 token */
	folder: FolderItem | null
	onClose: () => void
	onDone: () => void
}

/** 设为/取消隐私文件夹确认框（嵌套限制等校验在服务端，失败信息直接 toast） */
export default function PrivacySettingsDialog({
	folder,
	onClose,
	onDone,
}: PrivacySettingsDialogProps) {
	const [submitting, setSubmitting] = useState(false)
	const isPrivate = !!folder?.isPrivate

	const handleSubmit = async () => {
		if (!folder) return
		setSubmitting(true)
		try {
			const res = await setFolderPrivacy(folder.id, !isPrivate)
			if (res.success) {
				toast.success(res.message || (isPrivate ? '已取消隐私' : '已设为隐私文件夹'))
				onClose()
				onDone()
			} else {
				toast.error(res.message || '操作失败')
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '操作失败')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<Dialog open={!!folder} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 break-all">
						{isPrivate ? (
							<LockOpen className="h-4 w-4 shrink-0" />
						) : (
							<Lock className="h-4 w-4 shrink-0" />
						)}
						{isPrivate
							? `取消「${folder?.name}」的隐私保护`
							: `将「${folder?.name}」设为隐私文件夹`}
					</DialogTitle>
					<DialogDescription className="text-xs leading-relaxed">
						{isPrivate
							? '取消隐私后，该文件夹及其内容将恢复为普通文件夹，列表、搜索和预览不再受保护。'
							: '设为隐私后，该文件夹（含所有子文件夹和文件）需解锁隐私空间才能访问；未解锁时不出现在搜索结果中、不生成预览。隐私文件夹内不支持嵌套设置隐私。'}
					</DialogDescription>
				</DialogHeader>
				<div className="flex justify-end gap-2">
					<Button variant="outline" size="sm" onClick={onClose}>
						取消
					</Button>
					<Button size="sm" onClick={handleSubmit} disabled={submitting}>
						{submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
						{isPrivate ? '取消隐私' : '设为隐私'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
