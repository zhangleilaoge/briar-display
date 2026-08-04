'use client'

import { type FileTypeFilter, createFolder } from '@/api/files'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FolderPlus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import UploadDialog from './UploadDialog'

const TYPE_TABS: { value: '' | FileTypeFilter; label: string }[] = [
	{ value: '', label: '全部' },
	{ value: 'image', label: '图片' },
	{ value: 'video', label: '视频' },
	{ value: 'text', label: '文本' },
	{ value: 'other', label: '其他' },
]

interface FileToolbarProps {
	search: string
	onSearchChange: (value: string) => void
	typeFilter: '' | FileTypeFilter
	onTypeFilterChange: (value: '' | FileTypeFilter) => void
	selectedCount: number
	onBulkDelete: () => void
	currentFolderId: string | null
	onFolderCreated: () => void
	onUploaded: () => void
}

/** 工具栏：搜索、类型筛选、批量删除、新建文件夹、上传 */
export default function FileToolbar({
	search,
	onSearchChange,
	typeFilter,
	onTypeFilterChange,
	selectedCount,
	onBulkDelete,
	currentFolderId,
	onFolderCreated,
	onUploaded,
}: FileToolbarProps) {
	const [folderDialogOpen, setFolderDialogOpen] = useState(false)
	const [folderName, setFolderName] = useState('')

	const handleCreateFolder = async () => {
		const name = folderName.trim()
		if (!name) return
		try {
			const res = await createFolder(name, currentFolderId)
			if (res.success) {
				toast.success('文件夹已创建')
				setFolderDialogOpen(false)
				setFolderName('')
				onFolderCreated()
			} else {
				toast.error(res.message || '创建失败')
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '创建失败')
		}
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex flex-wrap items-center gap-3">
				<div className="relative w-64">
					<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="搜索文件名..."
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						className="h-9 pl-8"
					/>
				</div>
				<Tabs
					value={typeFilter}
					onValueChange={(v) => onTypeFilterChange(v as '' | FileTypeFilter)}
				>
					<TabsList className="h-9">
						{TYPE_TABS.map((t) => (
							<TabsTrigger key={t.value} value={t.value} className="px-3 text-xs">
								{t.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>
			<div className="flex items-center gap-2">
				{selectedCount > 0 && (
					<Button variant="destructive" size="sm" onClick={onBulkDelete} className="gap-1.5">
						<Trash2 className="h-4 w-4" />
						删除 ({selectedCount})
					</Button>
				)}
				<Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
					<DialogTrigger asChild>
						<Button variant="outline" size="sm" className="gap-1.5">
							<FolderPlus className="h-4 w-4" />
							新建文件夹
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-sm">
						<DialogHeader>
							<DialogTitle>新建文件夹</DialogTitle>
						</DialogHeader>
						<div className="space-y-3">
							<Input
								placeholder="文件夹名"
								value={folderName}
								onChange={(e) => setFolderName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleCreateFolder()
								}}
							/>
							<Button onClick={handleCreateFolder} className="w-full">
								创建
							</Button>
						</div>
					</DialogContent>
				</Dialog>
				<UploadDialog folderId={currentFolderId} onUploaded={onUploaded} />
			</div>
		</div>
	)
}
