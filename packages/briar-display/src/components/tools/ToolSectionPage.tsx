'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Box, Boxes, Pencil, RefreshCw, RotateCcw, Shuffle, SquareStack } from 'lucide-react'
import { Suspense, useMemo, useState } from 'react'
import * as THREE from 'three'
import ToolsLayout from './ToolsLayout'
import {
	type Plane,
	type QuizKind,
	type QuizQuestion,
	type Solid,
	type Vec3,
	type Voxel,
	type VoxelColor,
	computeSection,
	generateQuiz,
	planeFromPoints,
	randomSolid,
	sectionToSvgPaths,
	setVoxelColor,
	solidLTetromino,
	solidSingleCube,
	solidStair3,
	solidVertices,
	toggleVoxel,
} from './toolSectionUtils'

function VoxelMesh({
	voxel,
	selected,
	onClick,
}: {
	voxel: Voxel
	selected?: boolean
	onClick?: () => void
}) {
	const color = voxel.color === 'gray' ? '#6b7280' : '#f8fafc'
	// 勿在 mesh 内嵌套原生 <lineSegments>：R3F 会当成 DOM line 属性链（data-line）并抛错，Canvas 整片黑屏。
	return (
		<mesh
			position={[voxel.x + 0.5, voxel.y + 0.5, voxel.z + 0.5]}
			onClick={(e) => {
				e.stopPropagation()
				onClick?.()
			}}
		>
			<boxGeometry args={[0.98, 0.98, 0.98]} />
			<meshStandardMaterial
				color={color}
				transparent
				opacity={0.92}
				metalness={0.05}
				roughness={0.55}
			/>
			<Edges
				threshold={15}
				color={selected ? '#2563eb' : '#334155'}
				scale={selected ? 1.02 : 1.005}
			/>
		</mesh>
	)
}

function SectionFill({ plane, solid }: { plane: Plane; solid: Solid }) {
	const meshes = useMemo(() => {
		const section = computeSection(solid, plane)
		const n = new THREE.Vector3(...plane.normal)
		if (n.lengthSq() < 1e-12) return []
		n.normalize()
		const tmp = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
		const u = new THREE.Vector3().crossVectors(n, tmp).normalize()
		const v = new THREE.Vector3().crossVectors(n, u).normalize()
		const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)

		return section.patches.flatMap((patch, i) => {
			if (patch.points.length < 3) return []
			const origin = new THREE.Vector3(...patch.points[0])
			const shape = new THREE.Shape()
			const to2 = (p: Vec3) => {
				const w = new THREE.Vector3(p[0], p[1], p[2]).sub(origin)
				return new THREE.Vector2(w.dot(u), w.dot(v))
			}
			const p0 = to2(patch.points[0])
			shape.moveTo(p0.x, p0.y)
			for (let k = 1; k < patch.points.length; k++) {
				const pk = to2(patch.points[k])
				shape.lineTo(pk.x, pk.y)
			}
			shape.closePath()
			return [
				{
					key: i,
					geometry: new THREE.ShapeGeometry(shape),
					position: origin.toArray() as [number, number, number],
					quaternion: quat.clone(),
					color: patch.color === 'gray' ? '#4b5563' : '#fbbf24',
				},
			]
		})
	}, [solid, plane])

	return (
		<>
			{meshes.map((m) => (
				<mesh
					key={m.key}
					geometry={m.geometry}
					position={m.position}
					quaternion={m.quaternion}
					renderOrder={2}
				>
					<meshStandardMaterial
						color={m.color}
						side={THREE.DoubleSide}
						transparent
						opacity={0.85}
						depthWrite={false}
					/>
				</mesh>
			))}
		</>
	)
}

function PointMarker({ p, label }: { p: Vec3; label?: string }) {
	return (
		<group position={[p[0], p[1], p[2]]}>
			<mesh>
				<sphereGeometry args={[0.08, 16, 16]} />
				<meshStandardMaterial color="#dc2626" />
			</mesh>
			{label ? (
				// drei Html 较重，这里用简单精灵替代：仅球标记，标签在侧栏显示
				<></>
			) : null}
		</group>
	)
}

function Scene({
	solid,
	plane,
	points,
	showSection,
	orbitEnabled,
	editMode,
	onToggle,
}: {
	solid: Solid
	plane: Plane | null
	points?: Vec3[]
	showSection: boolean
	orbitEnabled: boolean
	editMode?: boolean
	onToggle?: (v: Voxel) => void
}) {
	const center = useMemo(() => {
		if (solid.voxels.length === 0) return [0.5, 0.5, 0.5] as Vec3
		const xs = solid.voxels.map((v) => v.x + 0.5)
		const ys = solid.voxels.map((v) => v.y + 0.5)
		const zs = solid.voxels.map((v) => v.z + 0.5)
		return [
			(Math.min(...xs) + Math.max(...xs)) / 2,
			(Math.min(...ys) + Math.max(...ys)) / 2,
			(Math.min(...zs) + Math.max(...zs)) / 2,
		] as Vec3
	}, [solid])

	return (
		<Canvas
			camera={{ position: [4.5, 3.5, 4.5], fov: 40, near: 0.1, far: 100 }}
			className="h-full w-full rounded-lg"
			gl={{ antialias: true, alpha: false }}
			dpr={[1, 2]}
		>
			<color attach="background" args={['#eef3f8']} />
			<ambientLight intensity={0.85} />
			<directionalLight position={[5, 8, 3]} intensity={1.05} />
			<directionalLight position={[-3, 2, -4]} intensity={0.35} />
			<Suspense fallback={null}>
				<group position={[-center[0], -center[1], -center[2]]}>
					{solid.voxels.map((v) => (
						<VoxelMesh
							key={`${v.x},${v.y},${v.z}`}
							voxel={v}
							onClick={editMode ? () => onToggle?.(v) : undefined}
						/>
					))}
					{points?.map((p, i) => (
						<PointMarker key={`${p[0]},${p[1]},${p[2]},${i}`} p={p} label={'ABC'[i]} />
					))}
					{showSection && plane ? <SectionFill plane={plane} solid={solid} /> : null}
				</group>
				<OrbitControls
					makeDefault
					enablePan={false}
					enabled={orbitEnabled}
					minDistance={3}
					maxDistance={14}
				/>
				<gridHelper args={[8, 8, '#cbd5e1', '#e2e8f0']} position={[0, -center[1] - 0.01, 0]} />
			</Suspense>
		</Canvas>
	)
}

function SectionSvgPreview({
	solid,
	plane,
	size = 140,
}: {
	solid: Solid
	plane: Plane
	size?: number
}) {
	const section = useMemo(() => computeSection(solid, plane), [solid, plane])
	const svg = useMemo(() => sectionToSvgPaths(section, plane, size), [section, plane, size])
	return (
		<svg width={svg.width} height={svg.height} className="rounded border bg-white">
			{svg.paths.map((p, i) => (
				<path
					key={i}
					d={p.d}
					fill={p.color === 'gray' ? '#9ca3af' : '#fde68a'}
					stroke="#1e293b"
					strokeWidth={2}
				/>
			))}
		</svg>
	)
}

function OptionShape({ option }: { option: NonNullable<QuizQuestion['options'][number]> }) {
	if (option.colorGrid && option.colorGrid.length > 0) {
		const us = option.colorGrid.map((c) => c.u)
		const vs = option.colorGrid.map((c) => c.v)
		const minU = Math.min(...us)
		const maxU = Math.max(...us)
		const minV = Math.min(...vs)
		const maxV = Math.max(...vs)
		const span = Math.max(maxU - minU, maxV - minV, 1)
		const s = 100
		const pad = 12
		const scale = (s - pad * 2) / span
		return (
			<svg width={s} height={s} className="rounded border bg-white">
				{option.colorGrid.map((c, i) => (
					<rect
						key={i}
						x={pad + (c.u - minU) * scale}
						y={s - pad - (c.v - minV) * scale - scale * 0.85}
						width={scale * 0.85}
						height={scale * 0.85}
						fill={c.color === 'gray' ? '#6b7280' : '#f8fafc'}
						stroke="#334155"
						strokeWidth={1.5}
					/>
				))}
			</svg>
		)
	}
	if (option.section && option.section.patches.length > 0) {
		const n = option.section.patches[0].points
		const planeApprox: Plane = {
			point: n[0],
			normal: [0, 0, 1],
		}
		// 用自身点估法向
		if (n.length >= 3) {
			const ax = n[1][0] - n[0][0]
			const ay = n[1][1] - n[0][1]
			const az = n[1][2] - n[0][2]
			const bx = n[2][0] - n[0][0]
			const by = n[2][1] - n[0][1]
			const bz = n[2][2] - n[0][2]
			planeApprox.normal = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
		}
		const svg = sectionToSvgPaths(option.section, planeApprox, 100)
		return (
			<svg width={svg.width} height={svg.height} className="rounded border bg-white">
				{svg.paths.map((p, i) => (
					<path
						key={i}
						d={p.d}
						fill={p.color === 'gray' ? '#9ca3af' : '#e2e8f0'}
						stroke="#0f172a"
						strokeWidth={2}
					/>
				))}
			</svg>
		)
	}
	return (
		<div className="flex h-[100px] w-[100px] items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
			{option.label}
		</div>
	)
}

function SandboxPanel() {
	const [solid, setSolid] = useState<Solid>(() => solidLTetromino())
	const [picked, setPicked] = useState<Vec3[]>([])
	const [editMode, setEditMode] = useState(false)
	const [paint, setPaint] = useState<VoxelColor>('white')

	const plane = useMemo(() => {
		if (picked.length < 3) return null
		return planeFromPoints(picked[0], picked[1], picked[2])
	}, [picked])

	const section = useMemo(() => (plane ? computeSection(solid, plane) : null), [plane, solid])
	const verts = useMemo(() => solidVertices(solid), [solid])

	const pickVertex = (p: Vec3) => {
		setPicked((prev) => {
			const exists = prev.find((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2])
			if (exists) return prev.filter((q) => q !== exists)
			if (prev.length >= 3) return [prev[1], prev[2], p]
			return [...prev, p]
		})
	}

	return (
		<div className="grid flex-1 gap-4 lg:grid-cols-[1fr_320px]">
			<Card className="flex min-h-[420px] flex-col overflow-hidden">
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-base">立体预览</CardTitle>
					<div className="flex flex-wrap gap-2">
						<Button
							size="sm"
							variant={editMode ? 'default' : 'outline'}
							onClick={() => setEditMode((v) => !v)}
							className="gap-1"
						>
							<Pencil className="h-3.5 w-3.5" />
							{editMode ? '编辑中' : '编辑'}
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								setSolid(randomSolid(Math.random, 5 + Math.floor(Math.random() * 6)))
								setPicked([])
							}}
							className="gap-1"
						>
							<Shuffle className="h-3.5 w-3.5" />
							随机
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								setSolid(solidSingleCube())
								setPicked([])
							}}
							className="gap-1"
						>
							从零
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={() => {
								setSolid(solidLTetromino())
								setPicked([])
							}}
							className="gap-1"
						>
							<RotateCcw className="h-3.5 w-3.5" />L 例
						</Button>
					</div>
				</CardHeader>
				<CardContent className="min-h-0 flex-1 p-2 pt-0">
					<div className="h-[380px] w-full overflow-hidden rounded-lg border">
						<Scene
							solid={solid}
							plane={plane}
							points={picked}
							showSection={!!plane}
							orbitEnabled
							editMode={editMode}
							onToggle={(v) => {
								if (!editMode) return
								setSolid((s) =>
									setVoxelColor(s, v.x, v.y, v.z, paint === 'gray' ? 'white' : 'gray'),
								)
							}}
						/>
					</div>
				</CardContent>
			</Card>

			<div className="flex flex-col gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">选三点定平面</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-xs text-muted-foreground">
							点击下方格点顶点（已选 {picked.length}/3）。选满三点后实时显示截面。
						</p>
						<div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
							{verts.map((p) => {
								const active = picked.some((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2])
								const idx = picked.findIndex((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2])
								return (
									<button
										key={`${p[0]},${p[1]},${p[2]}`}
										type="button"
										onClick={() => pickVertex(p)}
										className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
									>
										{active ? `${'ABC'[idx]} ` : ''}({p[0]},{p[1]},{p[2]})
									</button>
								)
							})}
						</div>
						<div className="flex gap-2">
							<Button size="sm" variant="outline" onClick={() => setPicked([])}>
								清空选点
							</Button>
							{editMode ? (
								<>
									<Button
										size="sm"
										variant={paint === 'white' ? 'default' : 'outline'}
										onClick={() => setPaint('white')}
									>
										白
									</Button>
									<Button
										size="sm"
										variant={paint === 'gray' ? 'default' : 'outline'}
										onClick={() => setPaint('gray')}
									>
										灰
									</Button>
								</>
							) : null}
						</div>
						{editMode ? (
							<p className="text-xs text-muted-foreground">
								编辑模式：点击小立方体切换灰/白。下方可在邻格添加（仅整数）：
							</p>
						) : null}
						{editMode ? (
							<div className="flex flex-wrap gap-1">
								{(
									[
										[1, 0, 0],
										[0, 1, 0],
										[0, 0, 1],
										[-1, 0, 0],
										[0, -1, 0],
										[0, 0, -1],
									] as Vec3[]
								).map((d) => (
									<Button
										key={d.join(',')}
										size="sm"
										variant="secondary"
										onClick={() => {
											const base = solid.voxels[0] ?? { x: 0, y: 0, z: 0 }
											setSolid((s) => toggleVoxel(s, base.x + d[0], base.y + d[1], base.z + d[2]))
										}}
									>
										±{d.join('')}
									</Button>
								))}
								<Button size="sm" variant="secondary" onClick={() => setSolid(solidStair3())}>
									楼梯
								</Button>
							</div>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">截面</CardTitle>
					</CardHeader>
					<CardContent>
						{plane && section ? (
							<div className="space-y-2">
								<div className="flex items-center gap-3">
									<SectionSvgPreview solid={solid} plane={plane} />
									<div className="text-xs text-muted-foreground space-y-1">
										<div>块数：{section.patches.length}</div>
										<div>最大边数：{section.edgeCount}</div>
										<div className="break-all font-mono text-[10px]">
											sig: {section.signature.slice(0, 80)}
										</div>
									</div>
								</div>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">请选择三个不共线的格点。</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

function QuizPanel() {
	const [kind, setKind] = useState<QuizKind>('Q1')
	const [q, setQ] = useState<QuizQuestion>(() => generateQuiz('Q1'))
	const [selected, setSelected] = useState<string | null>(null)
	const [revealed, setRevealed] = useState(false)

	const reload = (k: QuizKind = kind) => {
		setKind(k)
		setQ(generateQuiz(k))
		setSelected(null)
		setRevealed(false)
	}

	const orbitEnabled = !q.lockOrbitUntilAnswer || revealed
	const showCorrect = revealed && !!q.correctPlane

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				{(['Q1', 'Q3', 'Q4', 'Q7'] as QuizKind[]).map((k) => (
					<Button
						key={k}
						size="sm"
						variant={kind === k ? 'default' : 'outline'}
						onClick={() => reload(k)}
					>
						{k}
					</Button>
				))}
				<Button size="sm" variant="outline" className="gap-1" onClick={() => reload(kind)}>
					<RefreshCw className="h-3.5 w-3.5" />
					换一题
				</Button>
				<Badge variant="secondary">
					{kind === 'Q1' && '不可能截面'}
					{kind === 'Q3' && '过 ABC 着色'}
					{kind === 'Q4' && '选轮廓'}
					{kind === 'Q7' && '单立方禁形'}
				</Badge>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
				<Card className="overflow-hidden">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">题目立体</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="mb-2 text-sm leading-relaxed">{q.prompt}</p>
						{q.points ? (
							<p className="mb-2 font-mono text-xs text-muted-foreground">
								A({q.points[0].join(',')}) B({q.points[1].join(',')}) C({q.points[2].join(',')})
							</p>
						) : null}
						{!orbitEnabled ? (
							<p className="mb-2 text-xs text-amber-700">
								答题前旋转已锁定，提交后可转动并查看正确切面。
							</p>
						) : null}
						<div className="h-[320px] overflow-hidden rounded-lg border">
							<Scene
								solid={q.solid}
								plane={
									showCorrect
										? q.correctPlane!
										: q.correctPlane && kind === 'Q4' && !revealed
											? q.correctPlane
											: null
								}
								points={q.points}
								showSection={showCorrect || (kind === 'Q4' && !!q.correctPlane)}
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
							{q.options.map((opt) => {
								const isSel = selected === opt.id
								const showResult = revealed
								const ok = opt.isCorrect
								return (
									<button
										key={opt.id}
										type="button"
										disabled={revealed}
										onClick={() => setSelected(opt.id)}
										className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-left transition ${isSel ? 'border-primary ring-2 ring-primary/30 ' : 'hover:bg-muted/40 '}${showResult && ok ? 'bg-emerald-50 border-emerald-500 ' : ''}${showResult && isSel && !ok ? 'bg-rose-50 border-rose-400 ' : ''}`}
									>
										<div className="flex w-full items-center justify-between text-sm font-semibold">
											<span>{opt.id}</span>
											<span className="text-xs font-normal text-muted-foreground">{opt.label}</span>
										</div>
										<OptionShape option={opt} />
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
									{q.options.find((o) => o.id === selected)?.isCorrect ? (
										<span className="text-emerald-700">回答正确</span>
									) : (
										<span className="text-rose-700">
											回答错误，正确答案是 {q.options.find((o) => o.isCorrect)?.id}
										</span>
									)}
								</p>
							) : null}
						</div>
						{revealed && q.correctPlane ? (
							<div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
								<SectionSvgPreview solid={q.solid} plane={q.correctPlane} size={120} />
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
					<Badge variant="secondary">整数格点 · ≤27 体素</Badge>
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
						<SandboxPanel />
					</TabsContent>
					<TabsContent value="quiz" className="mt-4">
						<QuizPanel />
					</TabsContent>
				</Tabs>
			</div>
		</ToolsLayout>
	)
}
