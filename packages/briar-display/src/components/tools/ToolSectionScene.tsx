'use client'

import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { AdditionArrows, PointMarker, StarterCell, VoxelMesh } from './ToolSectionObjects'
import { type CutPoints, additionCells } from './toolSectionEditor'
import { MAX_VOXELS, type Plane, type Solid, type Vec3, computeSection } from './toolSectionUtils'
import { useToolSectionInteraction } from './useToolSectionInteraction'

type SceneProps = {
	solid: Solid
	plane: Plane | null
	points?: Vec3[]
	showSection?: boolean
	orbitEnabled?: boolean
	onPointsChange?: (points: CutPoints) => void
	selectedCell?: Vec3 | null
	onSelectCell?: (cell: Vec3 | null) => void
	onAddCell?: (cell: Vec3) => void
	onMoveCell?: (from: Vec3, to: Vec3) => void
	onRemoveCell?: (cell: Vec3) => void
}

const sameCell = (a: Vec3, b: Vec3) => a.every((value, index) => value === b[index])

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
		const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
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
			return [
				{
					key: index,
					geometry: new THREE.ShapeGeometry(shape),
					position: origin.toArray() as Vec3,
					quaternion: quaternion.clone(),
					color: patch.color === 'gray' ? '#4b5563' : '#fbbf24',
				},
			]
		})
	}, [solid, plane])
	useEffect(
		() => () => {
			for (const mesh of meshes) mesh.geometry.dispose()
		},
		[meshes],
	)
	return meshes.map((mesh) => (
		<mesh
			key={mesh.key}
			geometry={mesh.geometry}
			position={mesh.position}
			quaternion={mesh.quaternion}
			renderOrder={3}
		>
			<meshStandardMaterial
				color={mesh.color}
				side={THREE.DoubleSide}
				transparent
				opacity={0.82}
				depthWrite={false}
			/>
		</mesh>
	))
}

function PlaneSurface({ plane }: { plane: Plane }) {
	const quaternion = useMemo(() => {
		const normal = new THREE.Vector3(...plane.normal).normalize()
		return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
	}, [plane])
	return (
		<mesh position={[...plane.point]} quaternion={quaternion} renderOrder={1}>
			<planeGeometry args={[8, 8]} />
			<meshBasicMaterial
				color="#facc15"
				side={THREE.DoubleSide}
				transparent
				opacity={0.09}
				depthWrite={false}
			/>
		</mesh>
	)
}

function SceneContent({
	solid,
	plane,
	points,
	showSection = false,
	orbitEnabled = true,
	onPointsChange,
	selectedCell,
	onSelectCell,
	onAddCell,
	onMoveCell,
	onRemoveCell,
}: SceneProps) {
	const groupRef = useRef<THREE.Group>(null)
	const center = useMemo<Vec3>(() => {
		if (solid.voxels.length === 0) return [0.5, 0.5, 0.5]
		const xs = solid.voxels.map((voxel) => voxel.x + 0.5)
		const ys = solid.voxels.map((voxel) => voxel.y + 0.5)
		const zs = solid.voxels.map((voxel) => voxel.z + 0.5)
		return [
			(Math.min(...xs) + Math.max(...xs)) / 2,
			(Math.min(...ys) + Math.max(...ys)) / 2,
			(Math.min(...zs) + Math.max(...zs)) / 2,
		]
	}, [solid])
	const bottom = useMemo(
		() => (solid.voxels.length ? Math.min(...solid.voxels.map((voxel) => voxel.y)) : 0),
		[solid],
	)
	const availablePositions = useMemo(
		() => (onAddCell ? additionCells(solid, selectedCell) : []),
		[onAddCell, selectedCell, solid],
	)
	const { hoveredCell, dragPreview } = useToolSectionInteraction({
		groupRef,
		solid,
		points,
		orbitEnabled,
		onPointsChange,
		onSelectCell,
		onAddCell,
		onMoveCell,
		onRemoveCell,
	})
	const editable = !!(onSelectCell || onMoveCell || onRemoveCell)

	return (
		<>
			<group ref={groupRef} position={[-center[0], -center[1], -center[2]]}>
				{solid.voxels.map((voxel) => {
					const cell: Vec3 = [voxel.x, voxel.y, voxel.z]
					return (
						<VoxelMesh
							key={cell.join(',')}
							voxel={voxel}
							editable={editable}
							selected={selectedCell ? sameCell(cell, selectedCell) : false}
							hovered={hoveredCell ? sameCell(cell, hoveredCell) : false}
						/>
					)
				})}
				{selectedCell && onAddCell && solid.voxels.length < MAX_VOXELS ? (
					<AdditionArrows selectedCell={selectedCell} cells={availablePositions} />
				) : null}
				{solid.voxels.length === 0 && onAddCell ? <StarterCell /> : null}
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
						point={point}
						index={index}
						draggable={!!onPointsChange && solid.voxels.length > 0}
					/>
				))}
				{showSection && plane ? <PlaneSurface plane={plane} /> : null}
				{showSection && plane ? <SectionFill plane={plane} solid={solid} /> : null}
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
