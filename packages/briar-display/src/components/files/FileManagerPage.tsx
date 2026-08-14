'use client'

import {
	type FileItem,
	type FolderItem,
	deleteFile,
	deleteFolder,
	getFolders,
	moveFile,
} from '@/api/files'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { PERMISSIONS } from '@briar/shared'
import {
	AlertCircle,
	Clipboard,
	Download,
	Eye,
	FolderInput,
	FolderOpen,
	Loader2,
	Pencil,
	Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import FileBreadcrumb from './FileBreadcrumb'
import FileContextMenu, { type ContextMenuItem } from './FileContextMenu'
import FileDetailModal from './FileDetailModal'
import { ConfirmDialog, type ConfirmState, MoveFileDialog, RenameFolderDialog } from './FileDialogs'
import FileGrid from './FileGrid'
import FileManagerLayout from './FileManagerLayout'
import FileToolbar from './FileToolbar'
import { useFileList } from './useFileList'

interface ContextMenuState {
	x: number
	y: number
	file?: FileItem
	folder?: FolderItem
}

/** 浏览器下载文件（跨域失败时退化为新窗口打开） */
async function downloadFile(file: FileItem) {
	try {
		const res = await fetch(file.cdnUrl)
		const blob = await res.blob()
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = file.originalName
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	} catch {
		window.open(file.cdnUrl, '_blank')
	}
}

export default function FileManagerPage() {
	return (
		<PermissionProvider>
			<FileManagerPageInner />
		</PermissionProvider>
	)
}

function FileManagerPageInner() {
	const { loading: permLoading, denied } = useRequirePermission(PERMISSIONS.PAGE_BUSINESS)
	const {
		files,
		total,
		hasMore,
		loading,
		loadingMore,
		search,
		keyword,
		typeFilter,
		currentFolderId,
		sentinelRef,
		setTypeFilter,
		setCurrentFolderId,
		handleSearchChange,
		refresh,
	} = useFileList()

	const [folders, setFolders] = useState<FolderItem[]>([])
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [detailFile, setDetailFile] = useState<FileItem | null>(null)
	const [renameTarget, setRenameTarget] = useState<FolderItem | null>(null)
	const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
	const [moveTarget, setMoveTarget] = useState<FileItem | null>(null)
	const [dropFolderId, setDropFolderId] = useState<string | null>(null)

	const refreshFolders = useCallback(async () => {
		try {
			const res = await getFolders()
			if (res.success && res.data) setFolders(res.data)
		} catch {
			/* ignore */
		}
	}, [])

	useEffect(() => {
		refreshFolders()
	}, [refreshFolders])

	// URL 中的文件夹 id 失效（被删除或链接错误）时回退到根目录
	useEffect(() => {
		if (currentFolderId && folders.length > 0 && !folders.some((f) => f.id === currentFolderId)) {
			setCurrentFolderId(null)
		}
	}, [folders, currentFolderId, setCurrentFolderId])

	// 当前文件夹的面包屑路径（根 → ... → 当前）
	const folderPath: FolderItem[] = []
	{
		let cursor = currentFolderId ? folders.find((f) => f.id === currentFolderId) : undefined
		while (cursor) {
			folderPath.unshift(cursor)
			cursor = cursor.parentId ? folders.find((f) => f.id === cursor!.parentId) : undefined
		}
	}

	// 当前文件夹下的子文件夹（搜索或类型筛选时为扁平结果视图，隐藏文件夹）
	const subFolders =
		keyword || typeFilter ? [] : folders.filter((f) => (f.parentId ?? null) === currentFolderId)

	// ========== 选择 ==========

	const toggleSelect = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const toggleSelectAll = () => {
		if (selected.size === files.length) setSelected(new Set())
		else setSelected(new Set(files.map((i) => i.id)))
	}

	// ========== 删除 ==========

	const handleBulkDelete = () => {
		setConfirmState({
			title: `删除 ${selected.size} 个文件`,
			description: '删除后不可恢复，确定继续？',
			onConfirm: async () => {
				for (const id of selected) {
					try {
						await deleteFile(id)
					} catch {
						/* ignore */
					}
				}
				toast.success('删除成功')
				setSelected(new Set())
				refresh()
			},
		})
	}

	const confirmDeleteFile = (file: FileItem, onDeleted?: () => void) => {
		setConfirmState({
			title: `删除「${file.originalName}」`,
			description: '删除后不可恢复，确定继续？',
			onConfirm: async () => {
				try {
					await deleteFile(file.id)
					toast.success('删除成功')
				} catch {
					toast.error('删除失败')
				}
				onDeleted?.()
				refresh()
			},
		})
	}

	const handleDeleteFolder = (folder: FolderItem) => {
		setConfirmState({
			title: `删除文件夹「${folder.name}」`,
			description: '文件夹内的所有子文件夹和文件将一并删除，不可恢复，确定继续？',
			onConfirm: async () => {
				try {
					const res = await deleteFolder(folder.id)
					if (res.success) {
						toast.success(res.message || '删除成功')
					} else {
						toast.error(res.message || '删除失败')
					}
				} catch {
					toast.error('删除失败')
				}
				refreshFolders()
				refresh()
			},
		})
	}

	/** 移动文件到目标文件夹（拖拽用；移动对话框内部自处理） */
	const handleMoveFile = async (fileId: string, folderId: string | null) => {
		try {
			const res = await moveFile(fileId, folderId)
			if (res.success) {
				toast.success('移动成功')
			} else {
				toast.error(res.message || '移动失败')
			}
		} catch {
			toast.error('移动失败')
		}
		refresh()
	}

	// ========== 拖拽文件进文件夹 ==========

	const handleFileDragStart = (e: React.DragEvent, file: FileItem) => {
		e.dataTransfer.setData('application/x-briar-file-id', file.id)
		e.dataTransfer.effectAllowed = 'move'
	}

	const handleFolderDragOver = (e: React.DragEvent, folderId: string | null) => {
		if (!e.dataTransfer.types.includes('application/x-briar-file-id')) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'
		setDropFolderId(folderId)
	}

	const handleFolderDrop = (e: React.DragEvent, folderId: string | null) => {
		e.preventDefault()
		setDropFolderId(null)
		const fileId = e.dataTransfer.getData('application/x-briar-file-id')
		if (!fileId) return
		const file = files.find((f) => f.id === fileId)
		if (!file || (file.folderId ?? null) === folderId) return
		handleMoveFile(fileId, folderId)
	}

	// ========== 右键菜单 ==========

	const openFileContextMenu = (e: React.MouseEvent, file: FileItem) => {
		e.preventDefault()
		setContextMenu({ x: e.clientX, y: e.clientY, file })
	}

	const openFolderContextMenu = (e: React.MouseEvent, folder: FolderItem) => {
		e.preventDefault()
		setContextMenu({ x: e.clientX, y: e.clientY, folder })
	}

	const contextMenuItems: ContextMenuItem[] = contextMenu?.file
		? [
				{
					label: '预览',
					icon: <Eye className="h-4 w-4" />,
					onClick: () => setDetailFile(contextMenu.file!),
				},
				{
					label: '复制链接',
					icon: <Clipboard className="h-4 w-4" />,
					onClick: async () => {
						await navigator.clipboard.writeText(contextMenu.file!.cdnUrl)
						toast.success('链接已复制')
					},
				},
				{
					label: '下载',
					icon: <Download className="h-4 w-4" />,
					onClick: () => downloadFile(contextMenu.file!),
				},
				{
					label: '移动到...',
					icon: <FolderInput className="h-4 w-4" />,
					onClick: () => setMoveTarget(contextMenu.file!),
				},
				{
					label: '删除',
					icon: <Trash2 className="h-4 w-4" />,
					danger: true,
					onClick: () => confirmDeleteFile(contextMenu.file!),
				},
			]
		: contextMenu?.folder
			? [
					{
						label: '打开',
						icon: <FolderOpen className="h-4 w-4" />,
						onClick: () => setCurrentFolderId(contextMenu.folder!.id),
					},
					{
						label: '重命名',
						icon: <Pencil className="h-4 w-4" />,
						onClick: () => setRenameTarget(contextMenu.folder!),
					},
					{
						label: '删除',
						icon: <Trash2 className="h-4 w-4" />,
						danger: true,
						onClick: () => handleDeleteFolder(contextMenu.folder!),
					},
				]
			: []

	if (permLoading) {
		return (
			<FileManagerLayout>
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</FileManagerLayout>
		)
	}

	if (denied) {
		return (
			<FileManagerLayout>
				<div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
					<AlertCircle className="h-5 w-5" />
					<span>你没有权限访问此页面</span>
				</div>
			</FileManagerLayout>
		)
	}

	return (
		<FileManagerLayout>
			<div className="space-y-4">
				<FileToolbar
					search={search}
					onSearchChange={handleSearchChange}
					typeFilter={typeFilter}
					onTypeFilterChange={setTypeFilter}
					selectedCount={selected.size}
					onBulkDelete={handleBulkDelete}
					currentFolderId={currentFolderId}
					onFolderCreated={refreshFolders}
					onUploaded={refresh}
				/>

				{/* 文件夹路径面包屑 */}
				{!keyword && (
					<FileBreadcrumb
						folderPath={folderPath}
						onNavigate={setCurrentFolderId}
						onDragOver={handleFolderDragOver}
						onDragLeave={() => setDropFolderId(null)}
						onDrop={handleFolderDrop}
					/>
				)}

				{loading ? (
					<div className="flex items-center justify-center py-20">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : files.length === 0 && subFolders.length === 0 ? (
					<div className="py-20 text-center text-muted-foreground">
						{keyword || typeFilter ? '没有匹配的文件' : '这里还是空的，上传文件或新建文件夹吧'}
					</div>
				) : (
					<>
						<FileGrid
							files={files}
							subFolders={subFolders}
							selected={selected}
							total={total}
							dropFolderId={dropFolderId}
							onToggleSelect={toggleSelect}
							onToggleSelectAll={toggleSelectAll}
							onFileClick={setDetailFile}
							onFileContextMenu={openFileContextMenu}
							onFolderContextMenu={openFolderContextMenu}
							onFolderOpen={setCurrentFolderId}
							onFolderRename={setRenameTarget}
							onFolderDelete={handleDeleteFolder}
							onFileDragStart={handleFileDragStart}
							onFolderDragOver={handleFolderDragOver}
							onFolderDragLeave={() => setDropFolderId(null)}
							onFolderDrop={handleFolderDrop}
						/>

						{/* Infinite scroll sentinel */}
						<div ref={sentinelRef} className="h-1" />
						{loadingMore && (
							<div className="flex items-center justify-center py-6">
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
							</div>
						)}
						{!hasMore && files.length > 0 && (
							<div className="py-6 text-center text-xs text-muted-foreground">没有更多了</div>
						)}
					</>
				)}
			</div>

			{/* Detail modal */}
			{detailFile && (
				<FileDetailModal
					file={detailFile}
					onClose={() => setDetailFile(null)}
					onDelete={() => confirmDeleteFile(detailFile, () => setDetailFile(null))}
				/>
			)}

			<RenameFolderDialog
				target={renameTarget}
				onClose={() => setRenameTarget(null)}
				onRenamed={refreshFolders}
			/>

			<ConfirmDialog confirm={confirmState} onClose={() => setConfirmState(null)} />

			{/* Context menu */}
			{contextMenu && (
				<FileContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					items={contextMenuItems}
					onClose={() => setContextMenu(null)}
				/>
			)}

			<MoveFileDialog
				file={moveTarget}
				folders={folders}
				onClose={() => setMoveTarget(null)}
				onMoved={refresh}
			/>
		</FileManagerLayout>
	)
}
