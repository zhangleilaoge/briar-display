'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Box, Boxes, Play, RefreshCw, SquareStack } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GridSvgPreview, QuizOptionVisual } from './ToolQuizVisual'
import { ToolSectionSandbox } from './ToolSectionSandbox'
import { ToolSectionScene } from './ToolSectionScene'
import ToolsLayout from './ToolsLayout'
import { type QuizKind, type QuizOption, type QuizQuestion, generateQuiz } from './toolSectionQuiz'
import { cutPointsForPlane, planeKey } from './toolSectionUtils'

function OptionShape({ option }: { option: QuizOption }) {
	return <QuizOptionVisual visual={option.visual} size={128} />
}

const QUIZ_LABELS: Record<QuizKind, string> = {
	Q1: '不可能截面',
	Q2: '三视图',
	Q3: '三点着色',
	Q4: '截面轮廓',
	Q5: '方块计数',
	Q6: '展开图相对面',
	Q7: '立方体禁形',
	Q8: '立体拼合',
	Q9: '旋转镜像',
}

function QuizPanel() {
	const [kind, setKind] = useState<QuizKind>('Q1')
	const [question, setQuestion] = useState<QuizQuestion>(() => generateQuiz('Q1'))
	const [selected, setSelected] = useState<string | null>(null)
	const [revealed, setRevealed] = useState(false)
	const [previewId, setPreviewId] = useState<string | null>(null)
	const [assemblyRunId, setAssemblyRunId] = useState(0)

	const reload = (nextKind: QuizKind = kind) => {
		setKind(nextKind)
		setQuestion(generateQuiz(nextKind))
		setSelected(null)
		setRevealed(false)
		setPreviewId(null)
		setAssemblyRunId(0)
	}

	const correctOption = question.options.find((option) => option.isCorrect)!
	const activeOption = revealed
		? (question.options.find((option) => option.id === previewId) ?? correctOption)
		: null
	const activePoints = useMemo(() => {
		if (!activeOption?.plane) return undefined
		if (
			question.points &&
			question.correctPlane &&
			planeKey(activeOption.plane) === planeKey(question.correctPlane)
		) {
			return question.points
		}
		return cutPointsForPlane(question.solid, activeOption.plane) ?? undefined
	}, [activeOption, question])
	const scenePlane = revealed
		? (activeOption?.plane ?? null)
		: kind === 'Q4'
			? (question.correctPlane ?? null)
			: null
	const scenePoints = revealed ? activePoints : question.points
	const sceneSolid =
		activeOption?.visual.kind === 'solid' ? activeOption.visual.solid : question.solid
	const assemblyPiece =
		kind === 'Q8' && revealed && activeOption?.isCorrect && activeOption.visual.kind === 'solid'
			? activeOption.visual.solid
			: null
	const assembly = assemblyPiece
		? {
				base: question.solid,
				piece: assemblyPiece,
				runId: assemblyRunId,
			}
		: undefined

	const startAssembly = () => {
		setAssemblyRunId((current) => current + 1)
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				{(Object.keys(QUIZ_LABELS) as QuizKind[]).map((quizKind) => (
					<Button
						key={quizKind}
						size="sm"
						variant={kind === quizKind ? 'default' : 'outline'}
						onClick={() => reload(quizKind)}
					>
						{QUIZ_LABELS[quizKind]}
					</Button>
				))}
				<Button size="sm" variant="outline" className="gap-1" onClick={() => reload(kind)}>
					<RefreshCw className="h-3.5 w-3.5" />
					换一题
				</Button>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
				<Card className="overflow-hidden">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">
							{activeOption
								? `选项解析 · ${activeOption.id}`
								: question.questionGrid
									? '题目展开图'
									: '题目立体'}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="mb-2 text-sm leading-relaxed">{question.prompt}</p>
						<p className="mb-2 text-xs text-amber-700">
							{question.questionGrid
								? '先观察展开图的公共边，再判断折叠后的相对面。'
								: '可拖动左侧立体旋转查看；提交后悬停、聚焦或点击选项可切换解析。'}
						</p>
						{question.questionGrid ? (
							<div
								className="flex h-[360px] items-center justify-center rounded-lg border bg-muted/20"
								data-question-grid
							>
								<GridSvgPreview grid={question.questionGrid} size={280} />
							</div>
						) : (
							<div
								className="h-[360px] overflow-hidden rounded-lg border"
								data-quiz-scene
								data-orbit-enabled="true"
								data-active-option={activeOption?.id}
								data-has-plane={!!scenePlane}
								data-point-count={scenePoints?.length ?? 0}
								data-assembly={assembly ? 'combined' : undefined}
								data-assembly-run={assembly ? assemblyRunId : undefined}
							>
								<ToolSectionScene
									solid={sceneSolid}
									plane={scenePlane}
									points={scenePoints}
									showSection={!!scenePlane}
									assembly={assembly}
								/>
							</div>
						)}
						{assembly ? (
							<div className="mt-3 flex flex-wrap items-center gap-2" data-assembly-controls>
								<Button size="sm" variant="outline" className="gap-1" onClick={startAssembly}>
									<Play className="h-3.5 w-3.5" />
									{assemblyRunId > 0 ? '重新演示' : '演示拼合'}
								</Button>
								<span className="text-xs text-muted-foreground">
									灰色为原图，橙色为嵌合零件；动画开始前和进行中都可旋转。
								</span>
							</div>
						) : null}
						{activeOption ? (
							<p className="mt-2 text-xs text-muted-foreground" data-spatial-explanation>
								{activeOption.plane
									? `选项 ${activeOption.id}：ABC 确定切割平面，青色区域是截面；左侧可拖动旋转。`
									: `选项 ${activeOption.id}：${activeOption.explanation}`}
							</p>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">选项</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							{question.options.map((option) => {
								const isSelected = selected === option.id
								const isPreviewed = activeOption?.id === option.id
								return (
									<button
										key={option.id}
										type="button"
										aria-pressed={isSelected}
										data-option-id={option.id}
										data-has-real-plane={!!option.plane}
										onClick={() => {
											if (revealed) setPreviewId(option.id)
											else setSelected(option.id)
										}}
										onMouseEnter={() => {
											if (revealed) setPreviewId(option.id)
										}}
										onFocus={() => {
											if (revealed) setPreviewId(option.id)
										}}
										className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition hover:bg-muted/40 ${isSelected && !revealed ? 'border-primary ring-2 ring-primary/30 ' : ''}${revealed && option.isCorrect ? 'border-emerald-500 bg-emerald-50 ' : ''}${revealed && isSelected && !option.isCorrect ? 'border-rose-400 bg-rose-50 ' : ''}${isPreviewed ? 'ring-2 ring-sky-300 ' : ''}`}
									>
										<div className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
											<span className="shrink-0">{option.id}</span>
											<span className="text-right text-xs font-normal text-muted-foreground">
												{option.label}
											</span>
										</div>
										<OptionShape option={option} />
									</button>
								)
							})}
						</div>
						<div className="flex gap-2">
							<Button
								disabled={!selected || revealed}
								onClick={() => {
									setRevealed(true)
									setPreviewId(null)
									setAssemblyRunId(0)
								}}
							>
								提交答案
							</Button>
							{revealed ? (
								<p className="self-center text-sm">
									{question.options.find((option) => option.id === selected)?.isCorrect ? (
										<span className="text-emerald-700">回答正确</span>
									) : (
										<span className="text-rose-700">回答错误，正确答案是 {correctOption.id}</span>
									)}
								</p>
							) : null}
						</div>
						{activeOption ? (
							<div
								className="flex items-start gap-3 rounded-md border bg-muted/30 p-3"
								data-option-explanation={activeOption.id}
							>
								<QuizOptionVisual visual={activeOption.visual} size={120} />
								<div className="text-xs text-muted-foreground">
									<p className="font-medium text-foreground">
										{activeOption.id} · {activeOption.label}
									</p>
									<p className="mt-1">{activeOption.explanation}</p>
									<p className="mt-1">
										当前解析：{activeOption.id}；正确答案：{correctOption.id}。
									</p>
								</div>
							</div>
						) : null}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

export default function ToolSectionPage() {
	return (
		<ToolsLayout currentPath="/briar/tools/section">
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-2">
					<SquareStack className="h-5 w-5 text-muted-foreground" />
					<h1 className="text-lg font-semibold">切面模拟器</h1>
					<Badge variant="secondary">整数格点 · 自由搭建</Badge>
				</div>

				<Tabs defaultValue="sandbox">
					<TabsList>
						<TabsTrigger value="sandbox" className="gap-1.5">
							<Boxes className="h-4 w-4" />
							沙盒
						</TabsTrigger>
						<TabsTrigger value="quiz" className="gap-1.5">
							<Box className="h-4 w-4" />
							做题
						</TabsTrigger>
					</TabsList>
					<TabsContent value="sandbox" className="mt-4">
						<ToolSectionSandbox />
					</TabsContent>
					<TabsContent value="quiz" className="mt-4">
						<QuizPanel />
					</TabsContent>
				</Tabs>
			</div>
		</ToolsLayout>
	)
}
