'use client'

import { type FolderItem, getFolders, uploadFiles } from '@/api/files'
import { fetchMediaBlob } from '@/api/media'
import { Button } from '@/components/ui/button'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { MediaItem } from './toolMediaUtils'

interface ToolMediaAddToDialogProps {
	/** 待添加的媒体项（null 时关闭） */
	items: MediaItem[] | null
	onClose: () => void
}

/** 添加到文件对话框：选择目标文件夹，经代理拉取后走文件模块直传上传 */
export default function ToolMediaAddToDialog({ items, onClose }: ToolMediaAddToDialogProps) {
	const [folders, setFolders] = useState<FolderItem[]>([])
	const [folderId, setFolderId] = useState('root')
	const [pickerOpen, setPickerOpen] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [progressText, setProgressText] = useState('')

	useEffect(() => {
		if (!items) return
		setFolderId('root')
		getFolders()
			.then((res) => {
				if (res.success && res.data) {
					setFolders(res.data)
				} else {
					toast.error(res.message || '文件夹列表加载失败')
				}
			})
			.catch(() => toast.error('文件夹列表加载失败'))
	}, [items])

	const handleConfirm = async () => {
		if (!items?.length || uploading) return
		setUploading(true)
		let okCount = 0
		try {
			for (let i = 0; i < items.length; i++) {
				const item = items[i]
				setProgressText(items.length > 1 ? `（${i + 1}/${items.length}）${item.label}` : item.label)
				const blob = await fetchMediaBlob(item.url)
				const file = new File([blob], item.filename, { type: blob.type || undefined })
				const results = await uploadFiles([file], {
					folderId: folderId === 'root' ? null : folderId,
				})
				if (results[0]?.error) {
					toast.error(`${item.label} 添加失败：${results[0].error}`)
				} else {
					okCount++
				}
			}
			if (okCount > 0) {
				toast.success(`已添加 ${okCount} 个文件，可到「文件」中查看`)
			}
			onClose()
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '添加失败，请稍后重试')
		} finally {
			setUploading(false)
			setProgressText('')
		}
	}

	const selectedName =
		folderId === 'root' ? '根目录' : (folders.find((f) => f.id === folderId)?.name ?? '选择文件夹')
	const options = [{ id: 'root', name: '根目录' }, ...folders]

	return (
		<Dialog open={!!items} onOpenChange={(open) => !open && !uploading && onClose()}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>添加到文件</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<p className="text-sm text-muted-foreground">
						{items && items.length === 1
							? `将「${items[0].label}」上传到所选文件夹`
							: `将已选 ${items?.length ?? 0} 项上传到所选文件夹`}
					</p>
					{/* Select 在 Dialog 里会被焦点圈拦截导致 hover 不高亮，改用 Popover+Command */}
					<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								disabled={uploading}
								className="w-full justify-between font-normal"
							>
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
					<Button className="w-full" onClick={handleConfirm} disabled={uploading}>
						{uploading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
						{uploading ? `上传中 ${progressText}` : '添加'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
