'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Box, Boxes, RefreshCw, SquareStack } from 'lucide-react'
import { useState } from 'react'
import { SectionSvgPreview, SectionSvgShapes } from './ToolSectionPreview'
import { ToolSectionSandbox } from './ToolSectionSandbox'
import { ToolSectionScene } from './ToolSectionScene'
import ToolsLayout from './ToolsLayout'
import { sectionToSvgPaths } from './toolSectionSvg'
import {
	type Plane,
	type QuizKind,
	type QuizQuestion,
	computeSection,
	generateQuiz,
} from './toolSectionUtils'

function OptionShape({ option }: { option: QuizQuestion['options'][number] }) {
	if (option.colorGrid && option.colorGrid.length > 0) {
		const us = option.colorGrid.map((cell) => cell.u)
		const vs = option.colorGrid.map((cell) => cell.v)
		const minU = Math.min(...us)
		const maxU = Math.max(...us)
		const minV = Math.min(...vs)
		const maxV = Math.max(...vs)
		const span = Math.max(maxU - minU, maxV - minV, 1)
		const size = 100
		const padding = 12
		const scale = (size - padding * 2) / span
		return (
			<svg width={size} height={size} className="rounded border bg-white">
				{option.colorGrid.map((cell, index) => (
					<rect
						key={`${cell.u}-${cell.v}-${index}`}
						x={padding + (cell.u - minU) * scale}
						y={size - padding - (cell.v - minV) * scale - scale * 0.85}
						width={scale * 0.85}
						height={scale * 0.85}
						fill={cell.color === 'gray' ? '#1f2937' : '#f8fafc'}
						stroke="#334155"
						strokeWidth={1.5}
					/>
				))}
			</svg>
		)
	}
	if (option.section && option.section.patches.length > 0) {
		const points = option.section.patches[0].points
		const planeApprox: Plane = { point: points[0], normal: [0, 0, 1] }
		if (points.length >= 3) {
			const ax = points[1][0] - points[0][0]
			const ay = points[1][1] - points[0][1]
			const az = points[1][2] - points[0][2]
			const bx = points[2][0] - points[0][0]
			const by = points[2][1] - points[0][1]
			const bz = points[2][2] - points[0][2]
			planeApprox.normal = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
		}
		const svg = sectionToSvgPaths(option.section, planeApprox, 100)
		return (
			<svg width={svg.width} height={svg.height} className="rounded border bg-white">
				<SectionSvgShapes svg={svg} />
			</svg>
		)
	}
	return (
		<div className="flex h-[100px] w-[100px] items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
			{option.label}
		</div>
	)
}

const QUIZ_LABELS: Record<QuizKind, string> = {
	Q1: '不可能截面',
	Q3: '三点着色',
	Q4: '截面轮廓',
	Q7: '立方体禁形',
}

function QuizPanel() {
	const [kind, setKind] = useState<QuizKind>('Q1')
	const [question, setQuestion] = useState<QuizQuestion>(() => generateQuiz('Q1'))
	const [selected, setSelected] = useState<string | null>(null)
	const [revealed, setRevealed] = useState(false)

	const reload = (nextKind: QuizKind = kind) => {
		setKind(nextKind)
		setQuestion(generateQuiz(nextKind))
		setSelected(null)
		setRevealed(false)
	}

	const orbitEnabled = !question.lockOrbitUntilAnswer || revealed
	const showCorrect = revealed && !!question.correctPlane

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
						<CardTitle className="text-base">题目立体</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="mb-2 text-sm leading-relaxed">{question.prompt}</p>
						{!orbitEnabled ? (
							<p className="mb-2 text-xs text-amber-700">
								答题前旋转已锁定，提交后可转动并查看正确切面。
							</p>
						) : null}
						<div className="h-[360px] overflow-hidden rounded-lg border">
							<ToolSectionScene
								solid={question.solid}
								plane={
									showCorrect
										? question.correctPlane!
										: question.correctPlane && kind === 'Q4' && !revealed
											? question.correctPlane
											: null
								}
								points={question.points}
								showSection={showCorrect || (kind === 'Q4' && !!question.correctPlane)}
								orbitEnabled={orbitEnabled}
							/>
						</div>
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
								const isCorrect = option.isCorrect
								return (
									<button
										key={option.id}
										type="button"
										disabled={revealed}
										onClick={() => setSelected(option.id)}
										className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition ${isSelected ? 'border-primary ring-2 ring-primary/30 ' : 'hover:bg-muted/40 '}${revealed && isCorrect ? 'border-emerald-500 bg-emerald-50 ' : ''}${revealed && isSelected && !isCorrect ? 'border-rose-400 bg-rose-50 ' : ''}`}
									>
										<div className="flex w-full items-center justify-between text-sm font-semibold">
											<span>{option.id}</span>
											<span className="text-xs font-normal text-muted-foreground">
												{option.label}
											</span>
										</div>
										<OptionShape option={option} />
									</button>
								)
							})}
						</div>
						<div className="flex gap-2">
							<Button disabled={!selected || revealed} onClick={() => setRevealed(true)}>
								提交答案
							</Button>
							{revealed ? (
								<p className="self-center text-sm">
									{question.options.find((option) => option.id === selected)?.isCorrect ? (
										<span className="text-emerald-700">回答正确</span>
									) : (
										<span className="text-rose-700">
											回答错误，正确答案是 {question.options.find((option) => option.isCorrect)?.id}
										</span>
									)}
								</p>
							) : null}
						</div>
						{revealed && question.correctPlane ? (
							<div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
								<SectionSvgPreview
									section={
										question.correctSection ?? computeSection(question.solid, question.correctPlane)
									}
									plane={question.correctPlane}
									size={120}
								/>
								<div className="text-xs text-muted-foreground">
									<p className="font-medium text-foreground">正确切面示意</p>
									<p className="mt-1">现在可以旋转立体查看空间关系。</p>
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
