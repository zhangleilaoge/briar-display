'use client'

import { type FileItem, type FolderItem, moveFile, renameFolder } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export interface ConfirmState {
	title: string
	description: string
	onConfirm: () => void
}

/** 通用确认对话框（删除等破坏性操作的二次确认） */
export function ConfirmDialog({
	confirm,
	onClose,
}: {
	confirm: ConfirmState | null
	onClose: () => void
}) {
	return (
		<Dialog open={!!confirm} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{confirm?.title}</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">{confirm?.description}</p>
				<div className="flex justify-end gap-2">
					<Button variant="outline" size="sm" onClick={onClose}>
						取消
					</Button>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => {
							confirm?.onConfirm()
							onClose()
						}}
					>
						确定
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

/** 重命名文件夹对话框 */
export function RenameFolderDialog({
	target,
	onClose,
	onRenamed,
}: {
	target: FolderItem | null
	onClose: () => void
	onRenamed: () => void
}) {
	const [name, setName] = useState('')

	useEffect(() => {
		if (target) setName(target.name)
	}, [target])

	const handleRename = async () => {
		if (!target) return
		const trimmed = name.trim()
		if (!trimmed) return
		try {
			const res = await renameFolder(target.id, trimmed)
			if (res.success) {
				toast.success('重命名成功')
				onClose()
				onRenamed()
			} else {
				toast.error(res.message || '重命名失败')
			}
		} catch {
			toast.error('重命名失败')
		}
	}

	return (
		<Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>重命名文件夹</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') handleRename()
						}}
					/>
					<Button onClick={handleRename} className="w-full">
						保存
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

/** 移动文件到文件夹对话框 */
export function MoveFileDialog({
	file,
	folders,
	onClose,
	onMoved,
}: {
	file: FileItem | null
	folders: FolderItem[]
	onClose: () => void
	onMoved: () => void
}) {
	const [folderId, setFolderId] = useState('root')

	useEffect(() => {
		if (file) setFolderId(file.folderId ?? 'root')
	}, [file])

	const handleMove = async () => {
		if (!file) return
		try {
			const res = await moveFile(file.id, folderId === 'root' ? null : folderId)
			if (res.success) {
				toast.success('移动成功')
			} else {
				toast.error(res.message || '移动失败')
			}
		} catch {
			toast.error('移动失败')
		}
		onClose()
		onMoved()
	}

	return (
		<Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>移动「{file?.originalName}」到</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<Select value={folderId} onValueChange={setFolderId}>
						<SelectTrigger>
							<SelectValue placeholder="选择文件夹" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="root">根目录</SelectItem>
							{folders.map((f) => (
								<SelectItem key={f.id} value={f.id}>
									{f.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button className="w-full" onClick={handleMove}>
						移动
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
