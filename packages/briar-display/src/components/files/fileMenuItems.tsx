'use client'

import type { FileItem, FolderItem } from '@/api/files'
import {
	Clipboard,
	Download,
	Eye,
	FolderInput,
	FolderOpen,
	Lock,
	LockOpen,
	Pencil,
	Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ContextMenuItem } from './FileContextMenu'

interface BuildContextMenuParams {
	file?: FileItem
	folder?: FolderItem
	/** 文件是否处于隐私链路（隐藏「预览」「复制链接」） */
	fileIsPrivate: boolean
	/** 文件夹是否处于隐私链路（含祖先为隐私的情况；决定是否显示「设为隐私」） */
	folderInPrivateChain: boolean
	onPreviewFile: (file: FileItem) => void
	onDownloadFile: (file: FileItem) => void
	onRenameFile: (file: FileItem) => void
	onMoveFile: (file: FileItem) => void
	onDeleteFile: (file: FileItem) => void
	onOpenFolder: (folderId: string) => void
	onRenameFolder: (folder: FolderItem) => void
	onDeleteFolder: (folder: FolderItem) => void
	/** 设为/取消隐私（内部需先经过解锁门禁） */
	onTogglePrivacy: (folder: FolderItem) => void
}

/** 文件/文件夹右键菜单项构建（隐私链路规则：文件禁预览与复制链接；嵌套隐私不展示「设为隐私」） */
export function buildContextMenuItems({
	file,
	folder,
	fileIsPrivate,
	folderInPrivateChain,
	onPreviewFile,
	onDownloadFile,
	onRenameFile,
	onMoveFile,
	onDeleteFile,
	onOpenFolder,
	onRenameFolder,
	onDeleteFolder,
	onTogglePrivacy,
}: BuildContextMenuParams): ContextMenuItem[] {
	if (file) {
		return [
			...(!fileIsPrivate
				? [
						{
							label: '预览',
							icon: <Eye className="h-4 w-4" />,
							onClick: () => onPreviewFile(file),
						},
						{
							label: '复制链接',
							icon: <Clipboard className="h-4 w-4" />,
							onClick: async () => {
								await navigator.clipboard.writeText(file.cdnUrl)
								toast.success('链接已复制')
							},
						},
					]
				: []),
			{
				label: '下载',
				icon: <Download className="h-4 w-4" />,
				onClick: () => onDownloadFile(file),
			},
			{
				label: '重命名',
				icon: <Pencil className="h-4 w-4" />,
				onClick: () => onRenameFile(file),
			},
			{
				label: '移动到...',
				icon: <FolderInput className="h-4 w-4" />,
				onClick: () => onMoveFile(file),
			},
			{
				label: '删除',
				icon: <Trash2 className="h-4 w-4" />,
				danger: true,
				onClick: () => onDeleteFile(file),
			},
		]
	}
	if (folder) {
		return [
			{
				label: '打开',
				icon: <FolderOpen className="h-4 w-4" />,
				onClick: () => onOpenFolder(folder.id),
			},
			{
				label: '重命名',
				icon: <Pencil className="h-4 w-4" />,
				onClick: () => onRenameFolder(folder),
			},
			// 隐私文件夹可取消隐私；非隐私链路上的文件夹可设为隐私（嵌套隐私被禁）
			...(folder.isPrivate
				? [
						{
							label: '取消隐私',
							icon: <LockOpen className="h-4 w-4" />,
							onClick: () => onTogglePrivacy(folder),
						},
					]
				: !folderInPrivateChain
					? [
							{
								label: '设为隐私',
								icon: <Lock className="h-4 w-4" />,
								onClick: () => onTogglePrivacy(folder),
							},
						]
					: []),
			{
				label: '删除',
				icon: <Trash2 className="h-4 w-4" />,
				danger: true,
				onClick: () => onDeleteFolder(folder),
			},
		]
	}
	return []
}
