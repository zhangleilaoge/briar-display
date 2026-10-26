'use client'

import { GizmoHelper, GizmoViewport, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { AdditionArrows, PointMarker, StarterCell, VoxelMesh } from './ToolSectionObjects'
import { ASSEMBLY_DURATION, assemblyPieceOffset } from './toolSectionAssembly'
import { type CutPoints, additionCells } from './toolSectionEditor'
import { exposedSectionBoundaries } from './toolSectionGeometry'
import { type Plane, type Solid, type Vec3, type Voxel, computeSection } from './toolSectionUtils'
import { type PointerPosition, useToolSectionInteraction } from './useToolSectionInteraction'

type SceneProps = {
	solid: Solid
	plane: Plane | null
	points?: Vec3[]
	edgeSnap?: boolean
	showSection?: boolean
	orbitEnabled?: boolean
	assembly?: { base: Solid; piece: Solid; runId: number }
	onPointsChange?: (points: CutPoints) => void
	selectedCell?: Vec3 | null
	onSelectCell?: (cell: Vec3 | null) => void
	onAddCell?: (cell: Vec3) => void
	onMoveCell?: (from: Vec3, to: Vec3) => void
	onCellContextMenu?: (cell: Vec3, position: PointerPosition) => void
}

const sameCell = (a: Vec3, b: Vec3) => a.every((value, index) => value === b[index])

function AssemblyVoxels({
	piece,
	runId,
	renderVoxel,
}: {
	piece: Solid
	runId: number
	renderVoxel: (voxel: Voxel, accent?: boolean) => ReturnType<typeof VoxelMesh>
}) {
	const group = useRef<THREE.Group>(null)
	const animation = useRef<{ runId: number; startedAt: number } | null>(null)
	useFrame(({ clock }) => {
		if (!group.current) return
		if (runId === 0) {
			animation.current = null
			group.current.position.set(0, 0, 0)
			return
		}
		if (animation.current?.runId !== runId) {
			animation.current = { runId, startedAt: clock.elapsedTime }
		}
		const progress = ((clock.elapsedTime - animation.current.startedAt) * 1000) / ASSEMBLY_DURATION
		group.current.position.set(...assemblyPieceOffset(progress))
	})
	return (
		<group ref={group} position={assemblyPieceOffset(runId === 0 ? 1 : 0)}>
			{piece.voxels.map((voxel) => renderVoxel(voxel, true))}
		</group>
	)
}

function SectionFill({ plane, solid }: { plane: Plane; solid: Solid }) {
	const meshes = useMemo(() => {
		const section = computeSection(solid, plane)
		const normal = new THREE.Vector3(...plane.normal)
		if (normal.lengthSq() < 1e-12) return []
		normal.normalize()
		const temporary =
			Math.abs(normal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
		const u = new THREE.Vector3().crossVectors(normal, temporary).normalize()
		const v = new THREE.Vector3().crossVectors(normal, u).normalize()
		const quaternion = new THREE.Quaternion().setFromRotationMatrix(
			new THREE.Matrix4().makeBasis(u, v, normal),
		)
		return section.patches.flatMap((patch, index) => {
			if (patch.points.length < 3) return []
			const origin = new THREE.Vector3(...patch.points[0])
			const shape = new THREE.Shape()
			const to2 = (point: Vec3) => {
				const relative = new THREE.Vector3(...point).sub(origin)
				return new THREE.Vector2(relative.dot(u), relative.dot(v))
			}
			const first = to2(patch.points[0])
			shape.moveTo(first.x, first.y)
			for (const point of patch.points.slice(1)) {
				const next = to2(point)
				shape.lineTo(next.x, next.y)
			}
			shape.closePath()
			const boundaryPoints = exposedSectionBoundaries(solid, patch).flatMap(
				({ points, normal: outward }) => {
					const offset = new THREE.Vector3(...outward).multiplyScalar(0.003)
					return points.map((point) => new THREE.Vector3(...point).add(offset))
				},
			)
			const outline = boundaryPoints.length
				? new THREE.LineSegments(
						new THREE.BufferGeometry().setFromPoints(boundaryPoints),
						new THREE.LineDashedMaterial({
							color: patch.color === 'gray' ? '#5eead4' : '#0f766e',
							dashSize: 0.12,
							gapSize: 0.06,
							transparent: true,
							opacity: 0.95,
							depthTest: true,
							depthWrite: false,
							toneMapped: false,
						}),
					)
				: null
			outline?.computeLineDistances()
			return [
				{
					key: index,
					geometry: new THREE.ShapeGeometry(shape),
					position: origin.toArray() as Vec3,
					quaternion: quaternion.clone(),
					color: patch.color === 'gray' ? '#0f766e' : '#22d3ee',
					outline,
				},
			]
		})
	}, [solid, plane])
	useEffect(
		() => () => {
			for (const mesh of meshes) {
				mesh.geometry.dispose()
				mesh.outline?.geometry.dispose()
				mesh.outline?.material.dispose()
			}
		},
		[meshes],
	)
	return meshes.map((mesh) => (
		<group key={mesh.key}>
			<mesh
				geometry={mesh.geometry}
				position={mesh.position}
				quaternion={mesh.quaternion}
				renderOrder={3}
			>
				<meshBasicMaterial
					color={mesh.color}
					side={THREE.DoubleSide}
					transparent
					opacity={0.72}
					depthTest={false}
					depthWrite={false}
				/>
			</mesh>
			{mesh.outline ? <primitive object={mesh.outline} renderOrder={4} /> : null}
		</group>
	))
}

function SceneContent({
	solid,
	plane,
	points,
	edgeSnap = false,
	showSection = false,
	orbitEnabled = true,
	assembly,
	onPointsChange,
	selectedCell,
	onSelectCell,
	onAddCell,
	onMoveCell,
	onCellContextMenu,
}: SceneProps) {
	const groupRef = useRef<THREE.Group>(null)
	const displaySolid = useMemo<Solid>(
		() => (assembly ? { voxels: [...assembly.base.voxels, ...assembly.piece.voxels] } : solid),
		[assembly, solid],
	)
	const center = useMemo<Vec3>(() => {
		if (displaySolid.voxels.length === 0) return [0.5, 0.5, 0.5]
		const xs = displaySolid.voxels.map((voxel) => voxel.x + 0.5)
		const ys = displaySolid.voxels.map((voxel) => voxel.y + 0.5)
		const zs = displaySolid.voxels.map((voxel) => voxel.z + 0.5)
		return [
			(Math.min(...xs) + Math.max(...xs)) / 2,
			(Math.min(...ys) + Math.max(...ys)) / 2,
			(Math.min(...zs) + Math.max(...zs)) / 2,
		]
	}, [displaySolid])
	const bottom = useMemo(
		() =>
			displaySolid.voxels.length ? Math.min(...displaySolid.voxels.map((voxel) => voxel.y)) : 0,
		[displaySolid],
	)
	const availablePositions = useMemo(
		() => (onAddCell ? additionCells(displaySolid, selectedCell) : []),
		[onAddCell, selectedCell, displaySolid],
	)
	const { hoveredCell, dragPreview } = useToolSectionInteraction({
		groupRef,
		solid: displaySolid,
		points,
		edgeSnap,
		orbitEnabled,
		onPointsChange,
		onSelectCell,
		onAddCell,
		onMoveCell,
		onCellContextMenu,
	})
	const editable = !!(onSelectCell || onMoveCell || onCellContextMenu)
	const renderVoxel = (voxel: Voxel, accent = false) => {
		const cell: Vec3 = [voxel.x, voxel.y, voxel.z]
		return (
			<VoxelMesh
				key={cell.join(',')}
				voxel={voxel}
				editable={editable}
				selected={selectedCell ? sameCell(cell, selectedCell) : false}
				hovered={hoveredCell ? sameCell(cell, hoveredCell) : false}
				accent={accent}
			/>
		)
	}

	return (
		<>
			<group ref={groupRef} position={[-center[0], -center[1], -center[2]]}>
				{assembly ? (
					<>
						{assembly.base.voxels.map((voxel) => renderVoxel(voxel))}
						<AssemblyVoxels
							piece={assembly.piece}
							runId={assembly.runId}
							renderVoxel={renderVoxel}
						/>
					</>
				) : (
					displaySolid.voxels.map((voxel) => renderVoxel(voxel))
				)}
				{selectedCell && onAddCell ? (
					<AdditionArrows selectedCell={selectedCell} cells={availablePositions} />
				) : null}
				{displaySolid.voxels.length === 0 && onAddCell ? <StarterCell /> : null}
				{dragPreview ? (
					<mesh
						position={[
							dragPreview.cell[0] + 0.5,
							dragPreview.cell[1] + 0.5,
							dragPreview.cell[2] + 0.5,
						]}
						renderOrder={8}
					>
						<boxGeometry args={[1.002, 1.002, 1.002]} />
						<meshBasicMaterial
							color={dragPreview.valid ? '#2563eb' : '#dc2626'}
							transparent
							opacity={0.42}
							depthTest={false}
						/>
					</mesh>
				) : null}
				{points?.map((point, index) => (
					<PointMarker
						key={index}
						solid={displaySolid}
						point={point}
						index={index}
						draggable={!!onPointsChange && displaySolid.voxels.length > 0}
					/>
				))}
				{showSection && plane ? <SectionFill plane={plane} solid={displaySolid} /> : null}
			</group>
			<OrbitControls
				makeDefault
				enableDamping={false}
				enablePan={false}
				enabled={orbitEnabled}
				minDistance={3}
				maxDistance={16}
			/>
			<gridHelper
				args={[16, 16, '#cbd5e1', '#e2e8f0']}
				position={[0, bottom - center[1] - 0.01, 0]}
			/>
			<GizmoHelper alignment="bottom-left" margin={[60, 60]}>
				<GizmoViewport
					axisColors={['#ef4444', '#22c55e', '#3b82f6']}
					labelColor="#ffffff"
					hideNegativeAxes
					disabled={!orbitEnabled}
				/>
			</GizmoHelper>
		</>
	)
}

export function ToolSectionScene(props: SceneProps) {
	return (
		<Canvas
			camera={{ position: [5, 4, 5], fov: 40, near: 0.1, far: 100 }}
			className="h-full w-full rounded-lg"
			gl={{ antialias: true, alpha: false }}
			dpr={[1, 2]}
			onPointerMissed={() => props.onSelectCell?.(null)}
		>
			<color attach="background" args={['#eef3f8']} />
			<ambientLight intensity={0.85} />
			<directionalLight position={[5, 8, 3]} intensity={1.05} />
			<directionalLight position={[-3, 2, -4]} intensity={0.35} />
			<Suspense fallback={null}>
				<SceneContent {...props} />
			</Suspense>
		</Canvas>
	)
}
