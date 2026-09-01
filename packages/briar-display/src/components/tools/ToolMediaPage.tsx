'use client'

import { fetchMediaBlob, parseMedia } from '@/api/media'
import type { MediaParseResult } from '@briar/shared'
import { useState } from 'react'
import { toast } from 'sonner'
import ToolMediaAddToDialog from './ToolMediaAddToDialog'
import ToolMediaResult from './ToolMediaResult'
import ToolMediaSearchBar from './ToolMediaSearchBar'
import ToolsLayout from './ToolsLayout'
import {
	type MediaItem,
	type MediaSections,
	buildMediaSections,
	createZip,
	sanitizeFilename,
	saveBlob,
} from './toolMediaUtils'

export default function ToolMediaPage() {
	const [input, setInput] = useState('')
	const [parsing, setParsing] = useState(false)
	const [result, setResult] = useState<MediaParseResult | null>(null)
	const [sections, setSections] = useState<MediaSections | null>(null)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	// 下载中状态：itemId → 进度百分比（0-99），完成或失败后移除
	const [progress, setProgress] = useState<Record<string, number>>({})
	const [zipping, setZipping] = useState(false)
	const [zipPercent, setZipPercent] = useState(0)
	// 「添加到文件」弹窗目标（单个或多个媒体项）
	const [addTarget, setAddTarget] = useState<MediaItem[] | null>(null)

	const setItemProgress = (id: string, percent: number | null) => {
		setProgress((prev) => {
			const next = { ...prev }
			if (percent === null) {
				delete next[id]
			} else {
				next[id] = percent
			}
			return next
		})
	}

	const handleParse = async () => {
		const url = input.trim()
		if (!url || parsing) return
		setParsing(true)
		try {
			const res = await parseMedia(url)
			if (!res.success || !res.data) {
				toast.error(res.message || '解析失败')
				return
			}
			const next = buildMediaSections(res.data)
			const total =
				next.videos.length + next.images.length + next.livePhotos.length + (next.cover ? 1 : 0)
			if (total === 0) {
				toast.error('未解析到可下载的媒体')
				return
			}
			setResult(res.data)
			setSections(next)
			setSelected(new Set(next.images.map((item) => item.id)))
			toast.success('解析成功')
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '解析失败，请稍后重试')
		} finally {
			setParsing(false)
		}
	}

	const handleClear = () => {
		setInput('')
		setResult(null)
		setSections(null)
		setSelected(new Set())
		setProgress({})
	}

	const downloadItem = async (item: MediaItem): Promise<Uint8Array | null> => {
		setItemProgress(item.id, 0)
		try {
			const blob = await fetchMediaBlob(item.url, (p) => setItemProgress(item.id, p))
			return new Uint8Array(await blob.arrayBuffer())
		} catch (err: any) {
			toast.error(err?.response?.data?.message || `${item.label} 下载失败`)
			return null
		} finally {
			setItemProgress(item.id, null)
		}
	}

	const handleDownload = async (item: MediaItem) => {
		if (progress[item.id] !== undefined || zipping) return
		const data = await downloadItem(item)
		if (data) saveBlob(new Blob([data]), item.filename)
	}

	const handleToggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}

	const handleToggleAll = () => {
		if (!sections) return
		setSelected((prev) =>
			prev.size === sections.images.length
				? new Set()
				: new Set(sections.images.map((item) => item.id)),
		)
	}

	const handleZip = async () => {
		if (!sections || zipping) return
		const items = sections.images.filter((item) => selected.has(item.id))
		if (items.length === 0) {
			toast.error('请先勾选要下载的图片')
			return
		}
		setZipping(true)
		setZipPercent(0)
		try {
			const entries: { name: string; data: Uint8Array }[] = []
			for (let i = 0; i < items.length; i++) {
				const data = await downloadItem(items[i])
				if (!data) throw new Error('abort')
				entries.push({ name: items[i].filename, data })
				setZipPercent(Math.round(((i + 1) / items.length) * 100))
			}
			const zip = createZip(entries)
			saveBlob(zip, `${sanitizeFilename(result?.title || 'xhs-images')}.zip`)
			toast.success(`已打包 ${entries.length} 张图片`)
		} catch {
			// downloadItem 已提示失败原因
		} finally {
			setZipping(false)
			setZipPercent(0)
		}
	}

	return (
		<ToolsLayout currentPath="/briar/tools/media">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
				<ToolMediaSearchBar
					input={input}
					parsing={parsing}
					hasResult={!!sections}
					onInputChange={setInput}
					onParse={handleParse}
					onClear={handleClear}
				/>
				{sections && result && (
					<ToolMediaResult
						result={result}
						sections={sections}
						selected={selected}
						progress={progress}
						zipping={zipping}
						zipPercent={zipPercent}
						onDownload={handleDownload}
						onAddTo={setAddTarget}
						onToggle={handleToggle}
						onToggleAll={handleToggleAll}
						onZip={handleZip}
					/>
				)}
				<ToolMediaAddToDialog items={addTarget} onClose={() => setAddTarget(null)} />
			</div>
		</ToolsLayout>
	)
}
