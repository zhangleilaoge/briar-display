'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	ArrowLeftRight,
	ArrowUpDown,
	Magnet,
	RotateCcw,
	RotateCw,
	Shuffle,
	Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SectionSvgPreview } from './ToolSectionPreview'
import { ToolSectionScene } from './ToolSectionScene'
import { VoxelContextMenu, type VoxelMenuPosition } from './VoxelContextMenu'
import {
	type CutPoints,
	type VoxelEditError,
	addVoxel,
	defaultCutPoints,
	moveVoxel,
	removeVoxel,
} from './toolSectionEditor'
import { snapCutPointsToSolid } from './toolSectionGeometry'
import {
	type Solid,
	type Vec3,
	computeSection,
	planeFromPoints,
	randomSolid,
	setVoxelColor,
	solidLTetromino,
	voxelKey,
} from './toolSectionUtils'

const ERROR_MESSAGES: Record<VoxelEditError, string> = {
	invalid: '方块必须落在整数格点上',
	missing: '这块已经不存在，请重新选择',
	occupied: '目标位置已有方块',
}

export function ToolSectionSandbox() {
	const [solid, setSolid] = useState<Solid>(() => solidLTetromino())
	const [points, setPoints] = useState<CutPoints>(() => defaultCutPoints(solidLTetromino()))
	const [selectedCell, setSelectedCell] = useState<Vec3 | null>(null)
	const [rotation, setRotation] = useState(1)
	const [reflection, setReflection] = useState({ x: false, y: false })
	const [edgeSnap, setEdgeSnap] = useState(false)
	const [voxelMenu, setVoxelMenu] = useState<VoxelMenuPosition | null>(null)
	const cutPoints = useMemo(
		() =>
			solid.voxels.length ? snapCutPointsToSolid(solid, points, edgeSnap) : defaultCutPoints(solid),
		[solid, points, edgeSnap],
	)
	const plane = useMemo(
		() => planeFromPoints(cutPoints[0], cutPoints[1], cutPoints[2]),
		[cutPoints],
	)
	const section = useMemo(() => (plane ? computeSection(solid, plane) : null), [plane, solid])
	const contextVoxel = voxelMenu
		? solid.voxels.find((voxel) => voxelKey(voxel) === voxelMenu.cell.join(','))
		: undefined

	const loadSolid = (next: Solid) => {
		setSolid(next)
		setPoints(defaultCutPoints(next))
		setSelectedCell(null)
		setVoxelMenu(null)
	}

	const handleAdd = (cell: Vec3) => {
		const result = addVoxel(solid, cell)
		if (result.error) {
			toast.error(ERROR_MESSAGES[result.error])
			return
		}
		setSolid(result.solid)
		setSelectedCell(cell)
	}

	const handleMove = (from: Vec3, to: Vec3) => {
		const result = moveVoxel(solid, from, to)
		if (result.error) {
			toast.error(ERROR_MESSAGES[result.error])
			return
		}
		setSolid(result.solid)
		setSelectedCell(to)
	}

	const handleRemove = (cell: Vec3) => {
		setSolid((current) => removeVoxel(current, cell))
		setSelectedCell((current) =>
			current?.every((value, index) => value === cell[index]) ? null : current,
		)
		setVoxelMenu(null)
	}

	const handleToggleColor = (cell: Vec3) => {
		setSolid((current) => {
			const voxel = current.voxels.find((item) => voxelKey(item) === cell.join(','))
			return setVoxelColor(current, ...cell, voxel?.color === 'gray' ? 'white' : 'gray')
		})
		setSelectedCell(null)
	}

	const handleVoxelMenu = (cell: Vec3, position: Omit<VoxelMenuPosition, 'cell'>) => {
		setSelectedCell(cell)
		setVoxelMenu({ cell, ...position })
	}

	const deleteSelected = () => {
		if (selectedCell) handleRemove(selectedCell)
	}

	useEffect(() => {
		if (!selectedCell || voxelMenu) return
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null
			if (
				target?.isContentEditable ||
				['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
			) {
				return
			}
			if (event.key !== 'Delete' && event.key !== 'Backspace') return
			event.preventDefault()
			setSolid((current) => removeVoxel(current, selectedCell))
			setSelectedCell(null)
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [selectedCell, voxelMenu])

	return (
		<>
			<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
				<Card className="overflow-hidden">
					<CardHeader className="space-y-3 pb-3">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<CardTitle className="text-base">立体模型</CardTitle>
								<Badge variant="secondary">{solid.voxels.length} 块</Badge>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									size="sm"
									variant={edgeSnap ? 'default' : 'outline'}
									className="gap-1"
									aria-pressed={edgeSnap}
									onClick={() => setEdgeSnap((current) => !current)}
								>
									<Magnet className="h-3.5 w-3.5" />
									线吸附
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="gap-1"
									onClick={() =>
										loadSolid(randomSolid(Math.random, 5 + Math.floor(Math.random() * 6)))
									}
								>
									<Shuffle className="h-3.5 w-3.5" />
									随机生成
								</Button>
								<Button size="sm" variant="outline" onClick={() => loadSolid({ voxels: [] })}>
									清空模型
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="gap-1"
									onClick={() => loadSolid(solidLTetromino())}
								>
									<RotateCcw className="h-3.5 w-3.5" />L 形示例
								</Button>
							</div>
						</div>
						<p className="text-xs leading-relaxed text-muted-foreground">
							拖动空白旋转；拖动 A/B/C
							或标签调整切面；单击方块选中，点击箭头添加，左键拖动移动，右键打开菜单。
							开启「线吸附」后，切点只沿方块外露的棱移动。
						</p>
					</CardHeader>
					<CardContent className="space-y-3 pt-0">
						<div className="h-[520px] w-full overflow-hidden rounded-lg border">
							<ToolSectionScene
								solid={solid}
								plane={plane}
								points={solid.voxels.length ? cutPoints : undefined}
								edgeSnap={edgeSnap}
								showSection={!!plane && solid.voxels.length > 0}
								onPointsChange={setPoints}
								selectedCell={selectedCell}
								onSelectCell={setSelectedCell}
								onAddCell={handleAdd}
								onMoveCell={handleMove}
								onCellContextMenu={handleVoxelMenu}
							/>
						</div>
						{selectedCell ? (
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p className="text-xs text-muted-foreground">
									已选中 1 块，可拖动移动、点击箭头添加或右键打开菜单。
								</p>
								<Button size="sm" variant="destructive" className="gap-1" onClick={deleteSelected}>
									<Trash2 className="h-3.5 w-3.5" />
									删除选中
								</Button>
							</div>
						) : null}
					</CardContent>
				</Card>

				<Card className="h-fit xl:sticky xl:top-4">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">当前截面</CardTitle>
						<p className="text-xs text-muted-foreground">与三维青色交汇截面同步</p>
						<div className="grid grid-cols-2 gap-2 pt-2">
							<Button
								size="sm"
								variant="outline"
								className="h-8 flex-1 gap-1 px-2 text-xs"
								aria-label="截面逆时针旋转 90°"
								onClick={() => setRotation((current) => (current + 1) % 4)}
							>
								<RotateCcw className="h-3.5 w-3.5" />
								逆时针 90°
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="h-8 flex-1 gap-1 px-2 text-xs"
								aria-label="截面顺时针旋转 90°"
								onClick={() => setRotation((current) => (current + 3) % 4)}
							>
								<RotateCw className="h-3.5 w-3.5" />
								顺时针 90°
							</Button>
							<Button
								size="sm"
								variant={reflection.x ? 'default' : 'outline'}
								className="h-8 flex-1 gap-1 px-2 text-xs"
								aria-label="以 X 轴为对称轴上下翻转"
								aria-pressed={reflection.x}
								onClick={() => setReflection((current) => ({ ...current, x: !current.x }))}
							>
								<ArrowUpDown className="h-3.5 w-3.5" />X 对称
							</Button>
							<Button
								size="sm"
								variant={reflection.y ? 'default' : 'outline'}
								className="h-8 flex-1 gap-1 px-2 text-xs"
								aria-label="以 Y 轴为对称轴左右翻转"
								aria-pressed={reflection.y}
								onClick={() => setReflection((current) => ({ ...current, y: !current.y }))}
							>
								<ArrowLeftRight className="h-3.5 w-3.5" />Y 对称
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex min-h-[260px] items-center justify-center rounded-lg border bg-muted/20 p-3">
							{!plane ? (
								<p className="text-center text-sm text-muted-foreground">
									三个切点共线，拖动任一切点即可重新确定平面。
								</p>
							) : solid.voxels.length === 0 ? (
								<p className="text-center text-sm text-muted-foreground">
									模型为空，添加方块后即可查看截面。
								</p>
							) : section ? (
								<SectionSvgPreview
									section={section}
									plane={plane}
									points={cutPoints}
									size={240}
									rotation={rotation}
									reflectX={reflection.x}
									reflectY={reflection.y}
								/>
							) : null}
						</div>
						{solid.voxels.length > 0 ? (
							<div className="space-y-1.5 rounded-md bg-muted/40 p-3">
								<p className="mb-2 text-xs text-muted-foreground">切点坐标（x, y, z）</p>
								{cutPoints.map((point, index) => (
									<div
										key={'ABC'[index]}
										className="flex items-center justify-between gap-3 text-xs"
										data-cut-point-coordinates={'ABC'[index]}
									>
										<span
											className="font-semibold"
											style={{ color: ['#dc2626', '#ea580c', '#2563eb'][index] }}
										>
											{'ABC'[index]}
										</span>
										<span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
											(
											{point
												.map((value) => (Math.abs(value) < 0.0005 ? '0.000' : value.toFixed(3)))
												.join(', ')}
											)
										</span>
									</div>
								))}
							</div>
						) : null}
						<div className="grid grid-cols-2 gap-2 text-sm">
							<div className="rounded-md bg-muted/40 p-3">
								<p className="text-xs text-muted-foreground">截面块数</p>
								<p className="mt-1 font-semibold">{section?.patches.length ?? 0}</p>
							</div>
							<div className="rounded-md bg-muted/40 p-3">
								<p className="text-xs text-muted-foreground">最大边数</p>
								<p className="mt-1 font-semibold">{section?.edgeCount ?? 0}</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
			{voxelMenu && contextVoxel ? (
				<VoxelContextMenu
					menu={voxelMenu}
					isBlack={contextVoxel.color === 'gray'}
					onClose={() => setVoxelMenu(null)}
					onRemove={handleRemove}
					onToggleColor={handleToggleColor}
				/>
			) : null}
		</>
	)
}
