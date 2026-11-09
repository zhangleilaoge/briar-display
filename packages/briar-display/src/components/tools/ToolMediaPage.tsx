'use client'

import { isTokenUsable } from '@/api/auth'
import { clearMediaHistory, getMediaHistory, parseMedia, removeMediaHistory } from '@/api/media'
import type { MediaParseResult } from '@briar/shared'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import ToolMediaAddToDialog from './ToolMediaAddToDialog'
import ToolMediaHistory from './ToolMediaHistory'
import ToolMediaResult from './ToolMediaResult'
import ToolMediaSearchBar from './ToolMediaSearchBar'
import ToolsLayout from './ToolsLayout'
import { useMediaTasks } from './mediaTaskContext'
import {
	type MediaHistoryItem,
	type MediaItem,
	type MediaSections,
	buildMediaSections,
	extractShareUrl,
	loadMediaHistory,
	pushMediaHistory,
	sanitizeFilename,
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
	const { startDownload, startZip } = useMediaTasks()
	// 「添加到文件」弹窗目标（单个或多个媒体项）
	const [addTarget, setAddTarget] = useState<MediaItem[] | null>(null)
	const [history, setHistory] = useState<MediaHistoryItem[]>([])
	// 登录态：决定历史记录走服务端（按用户维度，跨设备互通）还是 localStorage（访客，本机）；
	// 同时控制「添加到」按钮显隐（上传文件需要登录态），下载/打包不受影响
	const [authed, setAuthed] = useState(false)
	// 访客历史已从 localStorage 载入后才允许回写（避免登录用户打开页面时把访客存档覆盖成空）
	const anonHistoryLoaded = useRef(false)

	// 客户端加载历史记录（避免 SSR hydration 不匹配）
	useEffect(() => {
		const ok = isTokenUsable()
		setAuthed(ok)
		if (ok) {
			getMediaHistory()
				.then((res) => {
					if (res.success && res.data) setHistory(res.data)
				})
				.catch(() => {})
		} else {
			anonHistoryLoaded.current = true
			setHistory(loadMediaHistory())
		}
	}, [])
	// 访客历史变更时持久化到 localStorage（登录用户的历史由服务端在解析时落库）
	useEffect(() => {
		if (!authed && anonHistoryLoaded.current) saveMediaHistory(history)
	}, [history, authed])

	/** 登录用户：从服务端刷新历史（解析成功后端已落库） */
	const refreshHistory = () => {
		getMediaHistory()
			.then((res) => {
				if (res.success && res.data) setHistory(res.data)
			})
			.catch(() => {})
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
			setSelected(
				new Set((next.images.length > 0 ? next.images : next.videos).map((item) => item.id)),
			)
			if (authed) {
				refreshHistory()
			} else {
				setHistory((prev) =>
					pushMediaHistory(prev, extractShareUrl(url), res.data!.title || '（无标题）'),
				)
			}
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

	/** 移除单条历史：登录用户同步删服务端记录（连带清对应媒体缓存） */
	const handleRemoveHistory = (url: string) => {
		setHistory((prev) => prev.filter((item) => item.url !== url))
		if (authed) {
			removeMediaHistory(url).catch(() => {
				toast.error('移除失败，请稍后重试')
				refreshHistory()
			})
		}
	}

	/** 清空历史：登录用户同步清服务端记录 */
	const handleClearHistory = () => {
		setHistory([])
		if (authed) {
			clearMediaHistory().catch(() => {
				toast.error('清空失败，请稍后重试')
				refreshHistory()
			})
		}
	}

	const handleClear = () => {
		setInput('')
		setResult(null)
		setSections(null)
		setSelected(new Set())
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

	const handleToggleAll = (kind: 'images' | 'videos' | 'livePhotos') => {
		if (!sections) return
		const pool =
			kind === 'images'
				? sections.images
				: kind === 'videos'
					? sections.videos
					: sections.livePhotos
		const ids = pool.map((item) => item.id)
		setSelected((prev) => {
			const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
			const next = new Set(prev)
			if (allSelected) {
				for (const id of ids) next.delete(id)
			} else {
				for (const id of ids) next.add(id)
			}
			return next
		})
	}

	const handleZip = (kind: 'images' | 'videos' | 'livePhotos') => {
		if (!sections) return
		const pool =
			kind === 'images'
				? sections.images
				: kind === 'videos'
					? sections.videos
					: sections.livePhotos
		const items = pool.filter((item) => selected.has(item.id))
		const noun = kind === 'images' ? '图片' : kind === 'videos' ? '视频' : '动态照片'
		if (items.length === 0) {
			toast.error(`请先勾选要下载的${noun}`)
			return
		}
		const fallback =
			kind === 'images' ? 'media-images' : kind === 'videos' ? 'media-videos' : 'media-live-photos'
		startZip(items, `${sanitizeFilename(result?.title || fallback)}.zip`)
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
					onRemove={handleRemoveHistory}
					onClear={handleClearHistory}
				/>
				{sections && result && (
					<ToolMediaResult
						result={result}
						sections={sections}
						selected={selected}
						canAddTo={authed}
						onDownload={startDownload}
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
