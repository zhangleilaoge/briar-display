'use client'

import { type FileItem, type FolderItem, moveFile } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
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
			{/* z-[120]：需盖过手写的 FileDetailModal（z-[100]），否则确认框被压在详情弹窗下且
			    Radix 锁定 body pointer-events 会导致详情弹窗点击穿透 */}
			<DialogContent className="z-[120] sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="break-all">{confirm?.title}</DialogTitle>
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

/** 重命名对话框（文件夹/文件通用，target.name 为当前名称） */
export function RenameDialog({
	title,
	target,
	onSubmit,
	onClose,
	onRenamed,
}: {
	title: string
	target: { id: string; name: string } | null
	onSubmit: (id: string, name: string) => Promise<{ success: boolean; message?: string }>
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
			const res = await onSubmit(target.id, trimmed)
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
					<DialogTitle>{title}</DialogTitle>
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
	const [pickerOpen, setPickerOpen] = useState(false)

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

	const selectedName =
		folderId === 'root' ? '根目录' : (folders.find((f) => f.id === folderId)?.name ?? '选择文件夹')
	const options = [{ id: 'root', name: '根目录' }, ...folders]

	return (
		<Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="break-all">移动「{file?.originalName}」到</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					{/* Select 在 Dialog 里会被焦点圈拦截导致 hover 不高亮，改用 Popover+Command */}
					<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
						<PopoverTrigger asChild>
							<Button variant="outline" className="w-full justify-between font-normal">
								{selectedName}
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent
							className="w-[--radix-popover-trigger-width] p-0"
							onOpenAutoFocus={(e) => e.preventDefault()}
						>
							<Command>
								<CommandList>
									<CommandGroup>
										{options.map((f) => (
											<CommandItem
												key={f.id}
												value={f.id}
												keywords={[f.name]}
												onSelect={() => {
													setFolderId(f.id)
													setPickerOpen(false)
												}}
											>
												{f.name}
												<Check
													className={cn(
														'ml-auto h-4 w-4',
														folderId === f.id ? 'opacity-100' : 'opacity-0',
													)}
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					<Button className="w-full" onClick={handleMove}>
						移动
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
