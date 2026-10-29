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
import { Fragment } from 'react'

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
		<Breadcrumb className="min-w-0">
			{/* 中文回退字体需要正常行高，避免字形上下被裁切 */}
			<BreadcrumbList className="gap-1 leading-normal sm:gap-1.5">
				<BreadcrumbItem className="min-w-0">
					{folderPath.length === 0 ? (
						<BreadcrumbPage className="truncate">全部文件</BreadcrumbPage>
					) : (
						<BreadcrumbLink
							href="#"
							className="truncate"
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
					<Fragment key={folder.id}>
						<BreadcrumbSeparator />
						<BreadcrumbItem className="min-w-0">
							{idx === folderPath.length - 1 ? (
								<BreadcrumbPage className="truncate">{folder.name}</BreadcrumbPage>
							) : (
								<BreadcrumbLink
									href="#"
									className="truncate"
									onClick={(e) => {
										e.preventDefault()
										onNavigate(folder.id)
									}}
								>
									{folder.name}
								</BreadcrumbLink>
							)}
						</BreadcrumbItem>
					</Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	)
}
