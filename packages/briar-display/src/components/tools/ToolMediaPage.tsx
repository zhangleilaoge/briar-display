'use client'

import { fetchMediaBlob, parseMedia } from '@/api/media'
import type { MediaParseResult } from '@briar/shared'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ToolMediaAddToDialog from './ToolMediaAddToDialog'
import ToolMediaHistory from './ToolMediaHistory'
import ToolMediaResult from './ToolMediaResult'
import ToolMediaSearchBar from './ToolMediaSearchBar'
import ToolsLayout from './ToolsLayout'
import {
	type MediaHistoryItem,
	type MediaItem,
	type MediaProgress,
	type MediaSections,
	buildMediaSections,
	createZip,
	extractShareUrl,
	loadMediaHistory,
	pushMediaHistory,
	sanitizeFilename,
	saveBlob,
	saveMediaHistory,
} from './toolMediaUtils'

export default function ToolMediaPage() {
	const [input, setInput] = useState('')
	const [parsing, setParsing] = useState(false)
	// 上游首解析偶发极慢（~60s），超过 8s 给用户一个「不是卡死」的提示
	const [slowHint, setSlowHint] = useState(false)
	const [result, setResult] = useState<MediaParseResult | null>(null)
	const [sections, setSections] = useState<MediaSections | null>(null)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	// 下载中状态：itemId → 进度（百分比 + 已下载字节数），完成或失败后移除
	const [progress, setProgress] = useState<Record<string, MediaProgress>>({})
	const [zipping, setZipping] = useState(false)
	const [zipPercent, setZipPercent] = useState(0)
	// 「添加到文件」弹窗目标（单个或多个媒体项）
	const [addTarget, setAddTarget] = useState<MediaItem[] | null>(null)
	const [history, setHistory] = useState<MediaHistoryItem[]>([])
	// 未登录时隐藏「添加到」（上传文件需要登录态），下载/打包不受影响
	const [canAddTo, setCanAddTo] = useState(false)

	// 客户端加载历史记录（避免 SSR hydration 不匹配），变更时持久化
	useEffect(() => {
		setHistory(loadMediaHistory())
		setCanAddTo(!!localStorage.getItem('briar_token'))
	}, [])
	useEffect(() => {
		saveMediaHistory(history)
	}, [history])

	const setItemProgress = (id: string, value: MediaProgress | null) => {
		setProgress((prev) => {
			const next = { ...prev }
			if (value === null) {
				delete next[id]
			} else {
				next[id] = value
			}
			return next
		})
	}

	const handleParse = async (rawInput?: string) => {
		const url = (rawInput ?? input).trim()
		if (!url || parsing) return
		setParsing(true)
		setSlowHint(false)
		const slowTimer = setTimeout(() => setSlowHint(true), 8000)
		try {
			const res = await parseMedia(url)
			if (!res.success || !res.data) {
				toast.error(res.message || '解析失败')
				return
			}
			const next = buildMediaSections(res.data, extractShareUrl(url))
			const total =
				next.videos.length + next.images.length + next.livePhotos.length + (next.cover ? 1 : 0)
			if (total === 0) {
				toast.error('未解析到可下载的媒体')
				return
			}
			setResult(res.data)
			setSections(next)
			setSelected(new Set(next.images.map((item) => item.id)))
			setHistory((prev) =>
				pushMediaHistory(prev, extractShareUrl(url), res.data!.title || '（无标题）'),
			)
			toast.success('解析成功')
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '解析失败，请稍后重试')
		} finally {
			clearTimeout(slowTimer)
			setSlowHint(false)
			setParsing(false)
		}
	}

	const handleSelectHistory = (url: string) => {
		setInput(url)
		handleParse(url)
	}

	const handleClear = () => {
		setInput('')
		setResult(null)
		setSections(null)
		setSelected(new Set())
		setProgress({})
	}

	const downloadItem = async (item: MediaItem): Promise<Uint8Array | null> => {
		setItemProgress(item.id, { percent: 0 })
		try {
			const blob = await fetchMediaBlob(
				item.url,
				(p, loaded, total) => setItemProgress(item.id, { percent: p, loaded, total }),
				item.sourceUrl,
			)
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
					slowHint={slowHint}
					hasResult={!!sections}
					onInputChange={setInput}
					onParse={() => handleParse()}
					onClear={handleClear}
				/>
				<ToolMediaHistory
					items={history}
					onSelect={handleSelectHistory}
					onRemove={(url) => setHistory((prev) => prev.filter((item) => item.url !== url))}
					onClear={() => setHistory([])}
				/>
				{sections && result && (
					<ToolMediaResult
						result={result}
						sections={sections}
						selected={selected}
						progress={progress}
						zipping={zipping}
						zipPercent={zipPercent}
						canAddTo={canAddTo}
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
