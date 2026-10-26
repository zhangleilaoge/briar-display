import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { cutPointLabelOffset } from './toolSectionGeometry'
import type { Solid, Vec3, Voxel } from './toolSectionUtils'

const POINT_COLORS = ['#dc2626', '#ea580c', '#2563eb']

function interaction(meta: Record<string, unknown>) {
	return { sectionInteraction: meta }
}

function LabelSprite({
	label,
	position,
	scale,
	meta,
}: {
	label: string
	position: Vec3
	scale: number
	meta?: Record<string, unknown>
}) {
	const texture = useMemo(() => {
		if (typeof document === 'undefined') return null
		const canvas = document.createElement('canvas')
		canvas.width = 128
		canvas.height = 128
		const context = canvas.getContext('2d')
		if (!context) return null
		context.fillStyle = '#0f172a'
		context.beginPath()
		context.arc(64, 64, 58, 0, Math.PI * 2)
		context.fill()
		context.strokeStyle = '#ffffff'
		context.lineWidth = 5
		context.stroke()
		context.fillStyle = '#ffffff'
		context.font = 'bold 64px sans-serif'
		context.textAlign = 'center'
		context.textBaseline = 'middle'
		context.fillText(label, 64, 68)
		const next = new THREE.CanvasTexture(canvas)
		next.colorSpace = THREE.SRGBColorSpace
		return next
	}, [label])
	useEffect(() => () => texture?.dispose(), [texture])
	if (!texture) return null
	return (
		<sprite
			position={position}
			scale={[scale, scale, scale]}
			renderOrder={11}
			userData={meta ? interaction(meta) : undefined}
		>
			<spriteMaterial map={texture} transparent depthTest depthWrite={false} />
		</sprite>
	)
}

export function PointMarker({
	solid,
	point,
	index,
	draggable,
}: {
	solid: Solid
	point: Vec3
	index: number
	draggable: boolean
}) {
	const meta = { kind: 'point', index }
	const labelPosition = useMemo(() => cutPointLabelOffset(solid, point), [solid, point])
	return (
		<group position={[...point]}>
			<mesh renderOrder={12} userData={draggable ? interaction(meta) : undefined}>
				<sphereGeometry args={[draggable ? 0.15 : 0.11, 20, 20]} />
				<meshBasicMaterial
					color={POINT_COLORS[index]}
					transparent
					opacity={1}
					depthTest
					depthWrite
					toneMapped={false}
				/>
			</mesh>
			{draggable ? (
				<mesh userData={interaction(meta)}>
					<sphereGeometry args={[0.24, 16, 16]} />
					<meshBasicMaterial transparent opacity={0} depthWrite={false} />
				</mesh>
			) : null}
			<LabelSprite
				label={'ABC'[index]}
				position={labelPosition}
				scale={0.34}
				meta={draggable ? meta : undefined}
			/>
		</group>
	)
}

export function VoxelMesh({
	voxel,
	selected,
	hovered,
	editable,
	accent = false,
}: {
	voxel: Voxel
	selected: boolean
	hovered: boolean
	editable: boolean
	accent?: boolean
}) {
	const edgeGeometry = useMemo(() => {
		const box = new THREE.BoxGeometry(1, 1, 1)
		const edges = new THREE.EdgesGeometry(box)
		box.dispose()
		return edges
	}, [])
	useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry])
	const cell: Vec3 = [voxel.x, voxel.y, voxel.z]
	return (
		<mesh
			position={[voxel.x + 0.5, voxel.y + 0.5, voxel.z + 0.5]}
			userData={editable ? interaction({ kind: 'voxel', cell }) : undefined}
		>
			<boxGeometry args={[1, 1, 1]} />
			<meshStandardMaterial
				color={
					selected
						? '#3b82f6'
						: hovered
							? '#bae6fd'
							: accent
								? '#f59e0b'
								: voxel.color === 'gray'
									? '#1f2937'
									: '#f8fafc'
				}
				emissive={accent ? '#d97706' : hovered ? '#38bdf8' : selected ? '#2563eb' : '#000000'}
				emissiveIntensity={accent ? 0.24 : hovered ? 0.38 : selected ? 0.16 : 0}
				transparent
				opacity={accent ? 0.86 : 0.55}
				depthWrite
				metalness={0.05}
				roughness={0.55}
			/>
			<lineSegments geometry={edgeGeometry} scale={selected ? 1.003 : 1.001}>
				<lineBasicMaterial
					color={accent ? '#b45309' : selected || hovered ? '#0284c7' : '#334155'}
				/>
			</lineSegments>
		</mesh>
	)
}

function AdditionArrow({ selectedCell, cell }: { selectedCell: Vec3; cell: Vec3 }) {
	const direction: Vec3 = [
		cell[0] - selectedCell[0],
		cell[1] - selectedCell[1],
		cell[2] - selectedCell[2],
	]
	const quaternion = new THREE.Quaternion().setFromUnitVectors(
		new THREE.Vector3(0, 1, 0),
		new THREE.Vector3(...direction),
	)
	const meta = interaction({ kind: 'add', cell })
	return (
		<group position={[selectedCell[0] + 0.5, selectedCell[1] + 0.5, selectedCell[2] + 0.5]}>
			<mesh
				position={[direction[0] * 0.58, direction[1] * 0.58, direction[2] * 0.58]}
				quaternion={quaternion}
				userData={meta}
			>
				<cylinderGeometry args={[0.035, 0.035, 0.28, 10]} />
				<meshStandardMaterial color="#2563eb" roughness={0.45} />
			</mesh>
			<mesh
				position={[direction[0] * 0.86, direction[1] * 0.86, direction[2] * 0.86]}
				quaternion={quaternion}
				userData={meta}
			>
				<coneGeometry args={[0.11, 0.24, 16]} />
				<meshStandardMaterial color="#2563eb" roughness={0.45} />
			</mesh>
			<mesh
				position={[direction[0] * 0.79, direction[1] * 0.79, direction[2] * 0.79]}
				userData={meta}
			>
				<sphereGeometry args={[0.18, 12, 12]} />
				<meshBasicMaterial transparent opacity={0} depthWrite={false} />
			</mesh>
		</group>
	)
}

export function AdditionArrows({
	selectedCell,
	cells,
}: {
	selectedCell: Vec3
	cells: Vec3[]
}) {
	return cells.map((cell) => (
		<AdditionArrow key={cell.join(',')} selectedCell={selectedCell} cell={cell} />
	))
}

export function StarterCell() {
	const meta = { kind: 'add', cell: [0, 0, 0] as Vec3 }
	return (
		<group position={[0.5, 0.5, 0.5]}>
			<mesh userData={interaction(meta)}>
				<boxGeometry args={[1, 1, 1]} />
				<meshStandardMaterial color="#22c55e" transparent opacity={0.24} depthWrite={false} />
			</mesh>
			<LabelSprite label="+" position={[0, 0, 0]} scale={0.55} meta={meta} />
		</group>
	)
}
