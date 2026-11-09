'use client'

import { type FolderItem, getFolders } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Loader2, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useMediaTasks } from './mediaTaskContext'
import type { MediaItem } from './toolMediaUtils'

interface ToolMediaAddToDialogProps {
	/** 待添加的媒体项（null 时关闭） */
	items: MediaItem[] | null
	onClose: () => void
}

/** 添加到文件对话框：只选择目标目录，确认后由全局任务中心执行下载与上传 */
export default function ToolMediaAddToDialog({ items, onClose }: ToolMediaAddToDialogProps) {
	const { startAdd } = useMediaTasks()
	const [folders, setFolders] = useState<FolderItem[]>([])
	const [folderId, setFolderId] = useState('root')
	const [pickerOpen, setPickerOpen] = useState(false)
	const [folderLoading, setFolderLoading] = useState(false)
	const [folderError, setFolderError] = useState('')
	const [reloadKey, setReloadKey] = useState(0)

	useEffect(() => {
		if (!items) return
		let cancelled = false
		setFolderId('root')
		setFolders([])
		setFolderError('')
		setFolderLoading(true)
		getFolders()
			.then((res) => {
				if (cancelled) return
				if (res.success && res.data) {
					setFolders(res.data)
				} else {
					const message = res.message || '文件夹列表加载失败'
					setFolderError(message)
					toast.error(message)
				}
			})
			.catch((err) => {
				if (cancelled) return
				if (err?.response?.status === 401) {
					toast.error('登录已过期，请重新登录后再添加')
					onClose()
					return
				}
				setFolderError('文件夹列表加载失败')
				toast.error('文件夹列表加载失败')
			})
			.finally(() => {
				if (!cancelled) setFolderLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [items, reloadKey])

	const selectedName =
		folderId === 'root' ? '根目录' : (folders.find((f) => f.id === folderId)?.name ?? '选择文件夹')
	const options = [{ id: 'root', name: '根目录' }, ...folders]

	const handleConfirm = () => {
		if (!items?.length || folderLoading || folderError) return
		if (startAdd(items, folderId === 'root' ? null : folderId, selectedName)) onClose()
	}

	return (
		<Dialog open={!!items} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				ornament
				className="sm:max-w-sm"
				onInteractOutside={(e) => {
					if (pickerOpen) e.preventDefault()
				}}
				onEscapeKeyDown={(e) => {
					if (!pickerOpen) return
					e.preventDefault()
					e.stopPropagation()
					setPickerOpen(false)
				}}
			>
				<DialogHeader>
					<DialogTitle>添加到文件</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<p className="text-sm text-muted-foreground">
						{items && items.length === 1
							? `将「${items[0].label}」上传到所选文件夹`
							: `将已选 ${items?.length ?? 0} 项上传到所选文件夹`}
					</p>
					<Select
						value={folderId}
						onValueChange={setFolderId}
						open={pickerOpen}
						onOpenChange={setPickerOpen}
						disabled={folderLoading || !!folderError}
					>
						<SelectTrigger className="w-full" aria-label="目标文件夹">
							{folderLoading ? (
								<span className="flex items-center gap-2 text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									正在加载文件夹…
								</span>
							) : folderError ? (
								<span className="text-muted-foreground">文件夹加载失败</span>
							) : (
								<SelectValue placeholder="选择文件夹" />
							)}
						</SelectTrigger>
						<SelectContent className="pointer-events-auto" sideOffset={4}>
							{options.map((folder) => (
								<SelectItem key={folder.id} value={folder.id}>
									{folder.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{folderError && (
						<div className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
							<span>{folderError}，请重试</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 shrink-0 px-2 text-xs"
								onClick={() => setReloadKey((value) => value + 1)}
							>
								<RotateCcw className="mr-1 h-3 w-3" />
								重试
							</Button>
						</div>
					)}
					<Button
						variant="primary"
						className="w-full"
						onClick={handleConfirm}
						disabled={folderLoading || !!folderError}
					>
						添加
					</Button>
					<p className="text-xs text-muted-foreground">
						确认后将在后台下载并上传，可继续操作页面。
					</p>
				</div>
			</DialogContent>
		</Dialog>
	)
}
