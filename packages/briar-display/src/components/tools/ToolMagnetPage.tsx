'use client'

import { parseMagnet } from '@/api/magnet'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { MagnetParseResult } from '@briar/shared'
import { Copy, Loader2, Magnet, RotateCcw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ToolsLayout from './ToolsLayout'
import { formatBytes, normalizeMagnetInput, readUrlParam, writeUrlParam } from './toolMagnetUtils'

/** file_type 中文映射，未知值原样展示 */
const FILE_TYPE_LABELS: Record<string, string> = {
	video: '视频',
	audio: '音频',
	image: '图片',
	folder: '文件夹',
	archive: '压缩包',
	document: '文档',
	text: '文本',
	font: '字体',
}

function fileTypeLabel(fileType: string): string {
	return FILE_TYPE_LABELS[fileType.toLowerCase()] || fileType
}

/** 截图缩略图：加载失败替换为占位块 */
function ScreenshotThumb({ url, onClick }: { url: string; onClick: () => void }) {
	const [failed, setFailed] = useState(false)
	if (failed) {
		return (
			<div className="flex aspect-[4/3] items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
				加载失败
			</div>
		)
	}
	return (
		<button type="button" onClick={onClick} className="group block w-full cursor-zoom-in">
			<img
				src={url}
				alt="预览截图"
				referrerPolicy="no-referrer"
				loading="lazy"
				onError={() => setFailed(true)}
				className="aspect-[4/3] w-full rounded-md border object-cover transition group-hover:opacity-90"
			/>
		</button>
	)
}

export default function ToolMagnetPage() {
	const [input, setInput] = useState('')
	const [parsing, setParsing] = useState(false)
	// 首解析上游要抓元数据偶发慢，超过 5s 给个「不是卡死」的提示
	const [slowHint, setSlowHint] = useState(false)
	const [result, setResult] = useState<MagnetParseResult | null>(null)
	/** 大图预览的截图 URL */
	const [preview, setPreview] = useState<string | null>(null)

	const handleParse = async (rawInput?: string) => {
		const value = (rawInput ?? input).trim()
		if (!value || parsing) return
		if (!normalizeMagnetInput(value)) {
			toast.error('无法识别的格式，支持 magnet / ed2k 链接或 40 位磁力 hash')
			return
		}
		setParsing(true)
		setSlowHint(false)
		const slowTimer = setTimeout(() => setSlowHint(true), 5000)
		try {
			const res = await parseMagnet(value)
			if (!res.success || !res.data) {
				toast.error(res.message || '查询失败')
				return
			}
			setResult(res.data)
			writeUrlParam(res.data.link)
			toast.success('查询成功')
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '查询失败，请稍后重试')
		} finally {
			clearTimeout(slowTimer)
			setSlowHint(false)
			setParsing(false)
		}
	}

	// 支持 ?url= 直达：自动填入并查询
	useEffect(() => {
		const url = readUrlParam()
		if (url) {
			setInput(url)
			handleParse(url)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const handleCopy = async () => {
		const value = input.trim()
		if (!value) {
			toast.error('请先粘贴链接')
			return
		}
		try {
			await navigator.clipboard.writeText(value)
			toast.success('已复制')
		} catch {
			toast.error('复制失败，请手动选择复制')
		}
	}

	const handleClear = () => {
		setInput('')
		setResult(null)
		setPreview(null)
		writeUrlParam('')
	}

	return (
		<ToolsLayout currentPath="/briar/tools/magnet">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
				<div className="flex flex-col gap-3 glass rounded-lg p-4">
					<div className="flex items-center gap-2">
						<Magnet className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-lg font-semibold">磁力查询</h1>
						<span className="hidden text-sm text-muted-foreground sm:inline">
							下载前先看一眼，避免「葫芦娃」
						</span>
					</div>
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="请输入 magnet、ed2k 或 40 位磁力 hash…"
						className="min-h-20 resize-y"
						onKeyDown={(e) => {
							if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
								e.preventDefault()
								handleParse()
							}
						}}
					/>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleCopy}>
								<Copy className="mr-1.5 h-4 w-4" />
								复制
							</Button>
							<Button variant="outline" size="sm" onClick={handleClear}>
								<RotateCcw className="mr-1.5 h-4 w-4" />
								清除
							</Button>
							<span className="text-xs text-muted-foreground">
								{slowHint && parsing
									? '首次查询需要抓取元数据，可能较慢…'
									: '支持 ⌘/Ctrl + Enter 快速查询'}
							</span>
						</div>
						<Button onClick={() => handleParse()} disabled={parsing || !input.trim()}>
							{parsing ? (
								<Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
							) : (
								<Search className="mr-1.5 h-4 w-4" />
							)}
							{parsing ? '查询中…' : '获取信息'}
						</Button>
					</div>
				</div>

				{result && (
					<div className="flex flex-col gap-3 glass rounded-lg p-4">
						<div className="grid grid-cols-[4.5rem_1fr] gap-y-2 text-sm sm:grid-cols-[5rem_1fr]">
							<span className="text-muted-foreground">名称</span>
							<span className="break-all font-medium">{result.name}</span>
							<span className="text-muted-foreground">大小</span>
							<span>{formatBytes(result.size)}</span>
							<span className="text-muted-foreground">文件</span>
							<span>{result.count} 个</span>
							{result.fileType && (
								<>
									<span className="text-muted-foreground">类型</span>
									<span>{fileTypeLabel(result.fileType)}</span>
								</>
							)}
						</div>
						{result.screenshots.length > 0 && (
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
								{result.screenshots.map((url) => (
									<ScreenshotThumb key={url} url={url} onClick={() => setPreview(url)} />
								))}
							</div>
						)}
					</div>
				)}

				<p className="text-center text-xs text-muted-foreground">
					数据来源{' '}
					<a
						href="https://whatslink.info"
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2 hover:text-foreground"
					>
						whatslink.info
					</a>{' '}
					· 仅提供链接信息查询，不提供下载
				</p>
			</div>

			<Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
				<DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
					<DialogTitle className="sr-only">截图预览</DialogTitle>
					{preview && (
						<img
							src={preview}
							alt="截图预览"
							referrerPolicy="no-referrer"
							className="max-h-[85vh] w-full rounded-md object-contain"
						/>
					)}
				</DialogContent>
			</Dialog>
		</ToolsLayout>
	)
}
