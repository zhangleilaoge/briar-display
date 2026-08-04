'use client'

import type { FolderItem } from '@/api/files'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface FileBreadcrumbProps {
	/** 根 → 当前 的文件夹路径 */
	folderPath: FolderItem[]
	onNavigate: (folderId: string | null) => void
	onDragOver: (e: React.DragEvent, folderId: string | null) => void
	onDragLeave: () => void
	onDrop: (e: React.DragEvent, folderId: string | null) => void
}

/** 文件夹路径面包屑（根目录兼作拖回根目录的放置目标） */
export default function FileBreadcrumb({
	folderPath,
	onNavigate,
	onDragOver,
	onDragLeave,
	onDrop,
}: FileBreadcrumbProps) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					{folderPath.length === 0 ? (
						<BreadcrumbPage>全部文件</BreadcrumbPage>
					) : (
						<BreadcrumbLink
							href="#"
							onClick={(e) => {
								e.preventDefault()
								onNavigate(null)
							}}
							onDragOver={(e) => onDragOver(e, null)}
							onDragLeave={onDragLeave}
							onDrop={(e) => onDrop(e, null)}
						>
							全部文件
						</BreadcrumbLink>
					)}
				</BreadcrumbItem>
				{folderPath.map((folder, idx) => (
					<span key={folder.id} className="contents">
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							{idx === folderPath.length - 1 ? (
								<BreadcrumbPage>{folder.name}</BreadcrumbPage>
							) : (
								<BreadcrumbLink
									href="#"
									onClick={(e) => {
										e.preventDefault()
										onNavigate(folder.id)
									}}
								>
									{folder.name}
								</BreadcrumbLink>
							)}
						</BreadcrumbItem>
					</span>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	)
}
