'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { MediaParseResult } from '@briar/shared'
import { Download, Loader2 } from 'lucide-react'
import type { MediaItem, MediaSections } from './toolMediaUtils'

interface ToolMediaResultProps {
	result: MediaParseResult
	sections: MediaSections
	selected: Set<string>
	progress: Record<string, number>
	zipping: boolean
	zipPercent: number
	onDownload: (item: MediaItem) => void
	onToggle: (id: string) => void
	onToggleAll: () => void
	onZip: () => void
}

function DownloadButton({
	item,
	percent,
	disabled,
	onDownload,
}: {
	item: MediaItem
	percent: number | undefined
	disabled: boolean
	onDownload: (item: MediaItem) => void
}) {
	const downloading = percent !== undefined
	return (
		<Button
			variant="outline"
			size="sm"
			disabled={downloading || disabled}
			onClick={() => onDownload(item)}
		>
			{downloading ? (
				<Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
			) : (
				<Download className="mr-1.5 h-4 w-4" />
			)}
			{downloading ? `${percent}%` : '下载'}
		</Button>
	)
}

export default function ToolMediaResult({
	result,
	sections,
	selected,
	progress,
	zipping,
	zipPercent,
	onDownload,
	onToggle,
	onToggleAll,
	onZip,
}: ToolMediaResultProps) {
	const allChecked = sections.images.length > 0 && selected.size === sections.images.length

	return (
		<div className="flex flex-col gap-6">
			{/* 作品信息 */}
			<div className="flex items-start gap-4 rounded-lg border bg-card p-4">
				{sections.cover && (
					<img
						src={sections.cover.url}
						alt="封面"
						referrerPolicy="no-referrer"
						className="h-24 w-24 shrink-0 rounded-md border object-cover"
					/>
				)}
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex items-center gap-2">
						<Badge variant="secondary">小红书</Badge>
						{result.author?.name && (
							<span className="text-sm text-muted-foreground">@{result.author.name}</span>
						)}
					</div>
					<p className="line-clamp-2 whitespace-pre-line text-sm">{result.title || '（无标题）'}</p>
					{sections.cover && (
						<div>
							<DownloadButton
								item={sections.cover}
								percent={progress[sections.cover.id]}
								disabled={zipping}
								onDownload={onDownload}
							/>
						</div>
					)}
				</div>
			</div>

			{/* 视频 */}
			{sections.videos.map((video) => (
				<div key={video.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
					<div className="flex items-center justify-between">
						<h2 className="font-semibold">{video.label}</h2>
						<DownloadButton
							item={video}
							percent={progress[video.id]}
							disabled={zipping}
							onDownload={onDownload}
						/>
					</div>
					{/* biome-ignore lint/a11y/useMediaCaption: 外链抓取的媒体没有字幕文件 */}
					<video
						src={video.url}
						controls
						preload="metadata"
						referrerPolicy="no-referrer"
						className="max-h-[480px] w-full rounded-md bg-black"
					/>
				</div>
			))}

			{/* 图集 */}
			{sections.images.length > 0 && (
				<div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
					<div className="flex items-center justify-between">
						<h2 className="font-semibold">
							图集原图
							<span className="ml-2 text-sm font-normal text-muted-foreground">
								共 {sections.images.length} 张
							</span>
						</h2>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={onToggleAll} disabled={zipping}>
								{allChecked ? '取消全选' : '全选'}
							</Button>
							<Button size="sm" onClick={onZip} disabled={zipping || selected.size === 0}>
								{zipping && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
								{zipping ? `打包中 ${zipPercent}%` : `打包下载所选图片 · ${selected.size}`}
							</Button>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
						{sections.images.map((image) => {
							const checked = selected.has(image.id)
							return (
								<div
									key={image.id}
									className={`flex flex-col overflow-hidden rounded-lg border-2 transition-colors ${
										checked ? 'border-primary' : 'border-transparent'
									}`}
								>
									<div className="relative">
										<img
											src={image.url}
											alt={image.label}
											referrerPolicy="no-referrer"
											loading="lazy"
											className="aspect-[3/4] w-full cursor-pointer bg-muted object-cover"
											onClick={() => onToggle(image.id)}
										/>
										<div
											className="absolute left-2 top-2 rounded bg-background/80 p-0.5"
											onClick={(e) => e.stopPropagation()}
										>
											<Checkbox
												checked={checked}
												onCheckedChange={() => onToggle(image.id)}
												aria-label={`选择${image.label}`}
											/>
										</div>
									</div>
									<div className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-2">
										<span className="text-sm">{image.label}</span>
										<DownloadButton
											item={image}
											percent={progress[image.id]}
											disabled={zipping}
											onDownload={onDownload}
										/>
									</div>
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* 动态照片 */}
			{sections.livePhotos.length > 0 && (
				<div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
					<h2 className="font-semibold">动态照片</h2>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
						{sections.livePhotos.map((live) => (
							<div key={live.id} className="flex flex-col overflow-hidden rounded-lg border">
								{/* biome-ignore lint/a11y/useMediaCaption: 外链抓取的媒体没有字幕文件 */}
								<video
									src={live.url}
									controls
									preload="metadata"
									referrerPolicy="no-referrer"
									className="aspect-[3/4] w-full bg-black object-cover"
								/>
								<div className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-2">
									<span className="text-sm">{live.label}</span>
									<DownloadButton
										item={live}
										percent={progress[live.id]}
										disabled={zipping}
										onDownload={onDownload}
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* 独立音轨 */}
			{sections.audio && (
				<div className="flex items-center justify-between rounded-lg border bg-card p-4">
					<h2 className="font-semibold">{sections.audio.label}</h2>
					<DownloadButton
						item={sections.audio}
						percent={progress[sections.audio.id]}
						disabled={zipping}
						onDownload={onDownload}
					/>
				</div>
			)}
		</div>
	)
}
