'use client'

import type { FileItem, FolderItem, FolderPreview } from '@/api/files'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Play, Trash2 } from 'lucide-react'
import FileTypeIcon from './FileTypeIcon'

/** 文件夹外观：双色 SVG 文件夹；内部有图片/视频时前几张缩略图扇形露出（视频叠半透明播放图标） */
function FolderVisual({ previews }: { previews: FolderPreview[] }) {
	const thumbs = previews.slice(0, 3)
	return (
		<div className="relative h-24 w-28">
			{/* 后板（含标签页凸起） */}
			<svg viewBox="0 0 112 84" aria-hidden className="absolute bottom-0 left-0 h-20 w-28">
				<path
					d="M8 20a8 8 0 0 1 8-8h22l10 10h48a8 8 0 0 1 8 8v46a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8Z"
					fill="#57A8F5"
				/>
			</svg>
			{/* 扇形预览图（z-[1]：低于前板 z-[2]，下半部被前板盖住，形成插在文件夹里的效果） */}
			{thumbs.map((item, i) => {
				const offset = i - (thumbs.length - 1) / 2
				const style = {
					transform: `translateX(calc(-50% + ${offset * 14}px)) rotate(${offset * 10}deg)`,
					transformOrigin: 'bottom center',
				}
				const cls =
					'absolute bottom-9 left-1/2 z-[1] h-14 w-12 rounded-md border border-black/5 bg-white shadow-md'
				if (item.isVideo) {
					// 无封面视频：<video preload="metadata"> 取首帧；播放图标在视频之上，但随容器整体低于前板
					return (
						<div key={`${item.url}-${i}`} className={cls} style={style}>
							<video
								src={item.url}
								muted
								playsInline
								preload="metadata"
								className="h-full w-full rounded-md object-cover"
							/>
							<Play className="pointer-events-none absolute inset-0 m-auto h-4 w-4 fill-white/80 text-white/80 drop-shadow" />
						</div>
					)
				}
				return (
					<img
						key={`${item.url}-${i}`}
						src={item.url}
						alt=""
						loading="lazy"
						className={`${cls} object-cover`}
						style={style}
					/>
				)
			})}
			{/* 前板 */}
			<svg viewBox="0 0 112 84" aria-hidden className="absolute bottom-0 left-0 z-[2] h-20 w-28">
				<path d="M4 32h104v44a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8Z" fill="#8CC8FA" />
			</svg>
		</div>
	)
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
	const d = new Date(dateStr)
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

interface FileGridProps {
	files: FileItem[]
	subFolders: FolderItem[]
	selected: Set<string>
	total: number
	dropFolderId: string | null
	onToggleSelect: (id: string) => void
	onToggleSelectAll: () => void
	onFileClick: (file: FileItem) => void
	onFileContextMenu: (e: React.MouseEvent, file: FileItem) => void
	onFolderContextMenu: (e: React.MouseEvent, folder: FolderItem) => void
	onFolderOpen: (folderId: string) => void
	onFolderRename: (folder: FolderItem) => void
	onFolderDelete: (folder: FolderItem) => void
	onFileDragStart: (e: React.DragEvent, file: FileItem) => void
	onFolderDragOver: (e: React.DragEvent, folderId: string | null) => void
	onFolderDragLeave: () => void
	onFolderDrop: (e: React.DragEvent, folderId: string | null) => void
}

/** 文件/文件夹网格（含全选行、拖拽放置目标、右键菜单入口） */
export default function FileGrid({
	files,
	subFolders,
	selected,
	total,
	dropFolderId,
	onToggleSelect,
	onToggleSelectAll,
	onFileClick,
	onFileContextMenu,
	onFolderContextMenu,
	onFolderOpen,
	onFolderRename,
	onFolderDelete,
	onFileDragStart,
	onFolderDragOver,
	onFolderDragLeave,
	onFolderDrop,
}: FileGridProps) {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{/* Select all */}
			{files.length > 0 && (
				<div className="col-span-full flex items-center gap-2 pb-1">
					<Checkbox
						checked={selected.size === files.length && files.length > 0}
						onCheckedChange={onToggleSelectAll}
					/>
					<span className="text-xs text-muted-foreground">
						全选（已选 {selected.size} / 当前 {files.length}，共 {total}）
					</span>
				</div>
			)}

			{/* 文件夹卡片 */}
			{subFolders.map((folder) => (
				<div
					key={folder.id}
					className="group relative"
					onContextMenu={(e) => onFolderContextMenu(e, folder)}
				>
					<div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
						<button
							type="button"
							title="重命名"
							className="rounded-md bg-background/80 p-1 shadow-sm hover:bg-background"
							onClick={(e) => {
								e.stopPropagation()
								onFolderRename(folder)
							}}
						>
							<Pencil className="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							title="删除"
							className="rounded-md bg-background/80 p-1 shadow-sm hover:bg-background"
							onClick={(e) => {
								e.stopPropagation()
								onFolderDelete(folder)
							}}
						>
							<Trash2 className="h-3.5 w-3.5 text-destructive" />
						</button>
					</div>
					<button
						type="button"
						onClick={() => onFolderOpen(folder.id)}
						onDragOver={(e) => onFolderDragOver(e, folder.id)}
						onDragLeave={onFolderDragLeave}
						onDrop={(e) => onFolderDrop(e, folder.id)}
						className={`flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted/50 transition-all hover:border-primary hover:shadow-md ${
							dropFolderId === folder.id ? 'border-primary bg-primary/10 shadow-md' : ''
						}`}
					>
						<FolderVisual previews={folder.previews ?? []} />
					</button>
					<div className="mt-1">
						<p className="truncate text-xs font-medium" title={folder.name}>
							{folder.name}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{(folder.fileCount ?? 0) > 0 ? `${folder.fileCount} 个文件` : '空文件夹'}
						</p>
					</div>
				</div>
			))}

			{/* 文件卡片 */}
			{files.map((file) => (
				<div
					key={file.id}
					className="group relative"
					onContextMenu={(e) => onFileContextMenu(e, file)}
				>
					<div className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
						<Checkbox
							checked={selected.has(file.id)}
							onCheckedChange={() => onToggleSelect(file.id)}
						/>
					</div>
					<button
						type="button"
						draggable
						onDragStart={(e) => onFileDragStart(e, file)}
						onClick={() => onFileClick(file)}
						className="relative aspect-square w-full cursor-grab overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary hover:shadow-md active:cursor-grabbing"
					>
						{file.mimeType.startsWith('image/') ? (
							<img
								src={file.thumbnailUrl || file.cdnUrl}
								alt={file.originalName}
								className="h-full w-full object-cover"
								loading="lazy"
							/>
						) : file.mimeType.startsWith('video/') ? (
							<>
								{file.thumbnailUrl ? (
									<img
										src={file.thumbnailUrl}
										alt={file.originalName}
										className="h-full w-full object-cover"
										loading="lazy"
									/>
								) : (
									<video
										src={file.cdnUrl}
										preload="metadata"
										muted
										className="h-full w-full object-cover"
									/>
								)}
								<span className="absolute inset-0 flex items-center justify-center">
									<span className="rounded-full bg-black/50 p-2">
										<Play className="h-5 w-5 text-white" />
									</span>
								</span>
							</>
						) : (
							<span className="flex h-full w-full items-center justify-center">
								<FileTypeIcon fileName={file.originalName} mimeType={file.mimeType} />
							</span>
						)}
					</button>
					<div className="mt-1 space-y-0.5">
						<p className="truncate text-xs font-medium" title={file.originalName}>
							{file.originalName}
						</p>
						<p className="truncate text-[11px] text-muted-foreground">
							{formatSize(file.size)} · {file.mimeType} · {formatDate(file.createdAt)}
						</p>
					</div>
				</div>
			))}
		</div>
	)
}
