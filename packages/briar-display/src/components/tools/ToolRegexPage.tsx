'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { RotateCcw, Spline } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ToolsLayout from './ToolsLayout'
import {
	DEFAULT_FLAGS,
	FLAG_KEYS,
	FLAG_LABELS,
	type RegexFlags,
	flagsToString,
	loadCache,
	renderRailroadSvg,
	saveCache,
	testRegex,
} from './toolRegexUtils'

const SAMPLE = '^[a-z]+@([a-z]+\\.)+[a-z]+$'

export default function ToolRegexPage() {
	const [pattern, setPattern] = useState('')
	const [flags, setFlags] = useState<RegexFlags>({ ...DEFAULT_FLAGS })
	const [testInput, setTestInput] = useState('')
	const [ready, setReady] = useState(false)
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const svgHostRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const cache = loadCache()
		setPattern(cache.pattern || SAMPLE)
		setFlags({ ...DEFAULT_FLAGS, ...cache.flags })
		setTestInput(cache.testInput || '')
		setReady(true)
	}, [])

	useEffect(() => {
		if (!ready) return
		if (saveTimer.current) clearTimeout(saveTimer.current)
		saveTimer.current = setTimeout(() => {
			saveCache({ pattern, flags, testInput })
		}, 400)
		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current)
		}
	}, [pattern, flags, testInput, ready])

	const flagStr = useMemo(() => flagsToString(flags), [flags])

	const diagram = useMemo(() => {
		try {
			return { svg: renderRailroadSvg(pattern, flagStr), error: null as string | null }
		} catch (e) {
			return { svg: '', error: (e as Error).message }
		}
	}, [pattern, flagStr])

	useEffect(() => {
		if (!svgHostRef.current) return
		svgHostRef.current.innerHTML = diagram.error ? '' : diagram.svg
	}, [diagram.error, diagram.svg])

	const matchResult = useMemo(
		() => testRegex(pattern, flagStr, testInput),
		[pattern, flagStr, testInput],
	)

	const toggleFlag = (key: keyof RegexFlags) => {
		setFlags((prev) => ({ ...prev, [key]: !prev[key] }))
	}

	const handleReset = () => {
		setPattern(SAMPLE)
		setFlags({ ...DEFAULT_FLAGS })
		setTestInput('')
	}

	return (
		<ToolsLayout currentPath="/briar/tools/regex">
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<Spline className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-lg font-semibold">正则可视化</h1>
						<Badge variant="secondary">Regexper 风格</Badge>
					</div>
					<Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
						<RotateCcw className="h-4 w-4" />
						重置示例
					</Button>
				</div>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">正则表达式</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-start gap-2 font-mono text-sm">
							<span className="mt-2 text-muted-foreground">/</span>
							<Textarea
								value={pattern}
								onChange={(e) => setPattern(e.target.value)}
								placeholder="输入正则…"
								className="min-h-[72px] font-mono text-sm"
								spellCheck={false}
							/>
							<span className="mt-2 text-muted-foreground">/{flagStr}</span>
						</div>
						<div className="flex flex-wrap gap-2">
							{FLAG_KEYS.map((key) => (
								<label
									key={key}
									className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${flags[key] ? 'border-primary bg-primary/5' : 'border-border'}`}
								>
									<input
										type="checkbox"
										checked={flags[key]}
										onChange={() => toggleFlag(key)}
										className="h-3.5 w-3.5"
									/>
									<span className="font-mono font-semibold">{key}</span>
									<span className="text-muted-foreground">{FLAG_LABELS[key]}</span>
								</label>
							))}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">铁路图</CardTitle>
					</CardHeader>
					<CardContent>
						{diagram.error ? (
							<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
								解析失败：{diagram.error}
							</div>
						) : (
							<div className="overflow-auto rounded-md border bg-white p-4 dark:bg-zinc-950">
								<div ref={svgHostRef} className="inline-block min-w-full" />
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">测试文本</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<Textarea
							value={testInput}
							onChange={(e) => setTestInput(e.target.value)}
							placeholder="输入用于匹配测试的文本…"
							className="min-h-[100px] font-mono text-sm"
							spellCheck={false}
						/>
						{matchResult.error ? (
							<div className="text-sm text-destructive">匹配错误：{matchResult.error}</div>
						) : testInput ? (
							<div className="space-y-2">
								<div className="text-sm text-muted-foreground">
									共 {matchResult.matches.length} 处匹配
								</div>
								{matchResult.matches.length === 0 ? (
									<div className="text-sm text-muted-foreground">无匹配</div>
								) : (
									<ul className="space-y-2">
										{matchResult.matches.map((m, i) => (
											<li
												key={`${i}:${m.index}`}
												className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs"
											>
												<div>
													#{i + 1} @ {m.index}:{' '}
													<span className="text-primary">{JSON.stringify(m.text)}</span>
												</div>
												{m.groups.length > 0 && (
													<div className="mt-1 text-muted-foreground">
														groups:{' '}
														{m.groups.map((g, gi) => `$${gi + 1}=${JSON.stringify(g)}`).join(', ')}
													</div>
												)}
											</li>
										))}
									</ul>
								)}
							</div>
						) : null}
					</CardContent>
				</Card>
			</div>
		</ToolsLayout>
	)
}
