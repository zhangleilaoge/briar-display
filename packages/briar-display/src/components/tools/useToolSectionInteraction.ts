import { useThree } from '@react-three/fiber'
import { type RefObject, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { type CutPoints, cellFromCenter, isOccupied } from './toolSectionEditor'
import {
	nearestExteriorEdgePoint,
	nearestExteriorPoint,
	raycastSolidSurface,
} from './toolSectionGeometry'
import type { Solid, Vec3 } from './toolSectionUtils'

export type DragPreview = { from: Vec3; cell: Vec3; valid: boolean }

type InteractionMeta =
	| { kind: 'point'; index: number }
	| { kind: 'voxel'; cell: Vec3 }
	| { kind: 'add'; cell: Vec3 }

type InteractionOptions = {
	groupRef: RefObject<THREE.Group | null>
	solid: Solid
	points?: Vec3[]
	edgeSnap?: boolean
	orbitEnabled: boolean
	onPointsChange?: (points: CutPoints) => void
	onSelectCell?: (cell: Vec3 | null) => void
	onAddCell?: (cell: Vec3) => void
	onMoveCell?: (from: Vec3, to: Vec3) => void
	onCellContextMenu?: (cell: Vec3, position: PointerPosition) => void
}

type DragBase = {
	pointerId: number
	startX: number
	startY: number
	moved: boolean
}

type PlaneDrag = DragBase & {
	plane: THREE.Plane
	offset: THREE.Vector3
}

type DragState =
	| (PlaneDrag & { kind: 'point'; index: number; original: CutPoints; current: CutPoints })
	| (PlaneDrag & { kind: 'voxel'; from: Vec3; target: Vec3; valid: boolean })
	| (DragBase & { kind: 'add'; cell: Vec3 })

export type PointerPosition = { clientX: number; clientY: number }

const sameCell = (a: Vec3 | null | undefined, b: Vec3 | null | undefined) =>
	a === b || (!!a && !!b && a.every((value, index) => value === b[index]))

const samePoint = (a: Vec3, b: Vec3) => a.every((value, index) => Math.abs(value - b[index]) < 1e-9)

function metaOf(object: THREE.Object3D): InteractionMeta | null {
	return (object.userData.sectionInteraction as InteractionMeta | undefined) ?? null
}

export function useToolSectionInteraction(options: InteractionOptions) {
	const { camera, gl } = useThree()
	const latest = useRef(options)
	latest.current = options
	const dragRef = useRef<DragState | null>(null)
	const [hoveredCell, setHoveredCell] = useState<Vec3 | null>(null)
	const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)

	useEffect(() => {
		const canvas = gl.domElement
		const raycaster = new THREE.Raycaster()

		const pointerRay = (event: PointerPosition) => {
			const rect = canvas.getBoundingClientRect()
			const pointer = new THREE.Vector2(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				-((event.clientY - rect.top) / rect.height) * 2 + 1,
			)
			camera.updateMatrixWorld()
			raycaster.setFromCamera(pointer, camera)
			return raycaster.ray.clone()
		}

		const interactiveObjects = () => {
			const group = latest.current.groupRef.current
			if (!group) return []
			const current = latest.current
			const canEditVoxel = !!(
				current.onSelectCell ||
				current.onMoveCell ||
				current.onCellContextMenu
			)
			const objects: THREE.Object3D[] = []
			group.updateWorldMatrix(true, true)
			group.traverse((object) => {
				const meta = metaOf(object)
				if (!meta) return
				if (meta.kind === 'point' && !current.onPointsChange) return
				if (meta.kind === 'voxel' && !canEditVoxel) return
				if (meta.kind === 'add' && !current.onAddCell) return
				objects.push(object)
			})
			return objects
		}

		const pick = (event: PointerPosition) => {
			const ray = pointerRay(event)
			const hits = raycaster.intersectObjects(interactiveObjects(), false)
			const point = hits.find((hit) => {
				if (metaOf(hit.object)?.kind !== 'point') return false
				return !hits.some((other) => {
					const kind = metaOf(other.object)?.kind
					return (kind === 'voxel' || kind === 'add') && other.distance < hit.distance - 1e-5
				})
			})
			if (point) return { meta: metaOf(point.object)!, ray }
			const addition = hits.find((hit) => {
				if (metaOf(hit.object)?.kind !== 'add') return false
				return !hits.some(
					(other) => metaOf(other.object)?.kind === 'voxel' && other.distance < hit.distance - 1e-5,
				)
			})
			if (addition) return { meta: metaOf(addition.object)!, ray }
			const voxel = hits.find((hit) => metaOf(hit.object)?.kind === 'voxel')
			return voxel ? { meta: metaOf(voxel.object)!, ray } : null
		}

		const consume = (event: PointerEvent | MouseEvent) => {
			event.preventDefault()
			event.stopImmediatePropagation()
		}

		const updateHover = (event: PointerPosition) => {
			const picked = pick(event)
			const next = picked?.meta.kind === 'voxel' ? picked.meta.cell : null
			setHoveredCell((previous) => (sameCell(previous, next) ? previous : next))
			canvas.style.cursor = picked
				? picked.meta.kind === 'add'
					? 'pointer'
					: 'grab'
				: latest.current.orbitEnabled
					? 'grab'
					: 'default'
		}

		const planeDragBase = (
			_event: PointerEvent,
			ray: THREE.Ray,
			localAnchor: Vec3,
		): Omit<PlaneDrag, keyof DragBase> | null => {
			const group = latest.current.groupRef.current
			if (!group) return null
			const worldAnchor = group.localToWorld(new THREE.Vector3(...localAnchor))
			const normal = camera.getWorldDirection(new THREE.Vector3())
			const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldAnchor)
			const hit = ray.intersectPlane(plane, new THREE.Vector3())
			if (!hit) return null
			return { plane, offset: worldAnchor.clone().sub(hit) }
		}

		const beginDrag = (event: PointerEvent, drag: DragState) => {
			consume(event)
			dragRef.current = drag
			canvas.setPointerCapture(event.pointerId)
			canvas.style.cursor = 'grabbing'
		}

		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return
			if (dragRef.current) {
				consume(event)
				return
			}
			const picked = pick(event)
			if (!picked) return
			const base: DragBase = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				moved: false,
			}
			const current = latest.current
			if (picked.meta.kind === 'add') {
				beginDrag(event, { ...base, kind: 'add', cell: picked.meta.cell })
				return
			}
			if (picked.meta.kind === 'point') {
				if (!current.points || current.points.length !== 3 || !current.onPointsChange) return
				const index = picked.meta.index
				const anchor = current.points[index]
				const planeBase = planeDragBase(event, picked.ray, anchor)
				if (!planeBase) return
				const original: CutPoints = [current.points[0], current.points[1], current.points[2]]
				beginDrag(event, {
					...base,
					...planeBase,
					kind: 'point',
					index,
					original,
					current: original,
				})
				return
			}
			const from = picked.meta.cell
			current.onSelectCell?.(from)
			const center: Vec3 = [from[0] + 0.5, from[1] + 0.5, from[2] + 0.5]
			const planeBase = planeDragBase(event, picked.ray, center)
			if (!planeBase) return
			beginDrag(event, {
				...base,
				...planeBase,
				kind: 'voxel',
				from,
				target: from,
				valid: true,
			})
		}

		const updatePointDrag = (event: PointerEvent, drag: Extract<DragState, { kind: 'point' }>) => {
			const group = latest.current.groupRef.current
			if (!group) return
			const ray = pointerRay(event)
			const target = ray.intersectPlane(drag.plane, new THREE.Vector3())
			if (!target) return
			target.add(drag.offset)
			const localTarget = group.worldToLocal(target.clone())
			let nextPoint: Vec3 | null = null
			if (latest.current.edgeSnap) {
				nextPoint = nearestExteriorEdgePoint(latest.current.solid, localTarget.toArray() as Vec3)
			} else {
				const localOrigin = group.worldToLocal(ray.origin.clone())
				const direction = localTarget.clone().sub(localOrigin)
				if (direction.lengthSq() < 1e-12) return
				const localRay = new THREE.Ray(localOrigin, direction.normalize())
				nextPoint =
					raycastSolidSurface(latest.current.solid, localRay, localTarget) ??
					nearestExteriorPoint(latest.current.solid, localTarget.toArray() as Vec3)
			}
			if (!nextPoint || samePoint(nextPoint, drag.current[drag.index])) return
			const next = [...drag.current] as CutPoints
			next[drag.index] = nextPoint
			drag.current = next
			latest.current.onPointsChange?.(next)
		}

		const updateVoxelDrag = (event: PointerEvent, drag: Extract<DragState, { kind: 'voxel' }>) => {
			const group = latest.current.groupRef.current
			if (!group) return
			const target = pointerRay(event).intersectPlane(drag.plane, new THREE.Vector3())
			if (!target) return
			target.add(drag.offset)
			const local = group.worldToLocal(target).toArray() as Vec3
			const cell = cellFromCenter(local)
			const valid = !isOccupied(latest.current.solid, cell, drag.from)
			drag.target = cell
			drag.valid = valid
			setDragPreview((previous) =>
				previous && sameCell(previous.cell, cell) && previous.valid === valid
					? previous
					: { from: drag.from, cell, valid },
			)
		}

		const onPointerMove = (event: PointerEvent) => {
			const drag = dragRef.current
			if (drag) {
				if (event.pointerId !== drag.pointerId) return
				consume(event)
				if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 4) {
					drag.moved = true
				}
				if (drag.kind === 'point') updatePointDrag(event, drag)
				if (drag.kind === 'voxel' && drag.moved) updateVoxelDrag(event, drag)
				return
			}
			if (event.buttons !== 0) {
				setHoveredCell(null)
				return
			}
			updateHover(event)
		}

		const releaseDrag = (event: PointerEvent) => {
			if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
		}

		const cancelDrag = (event: PointerEvent, release: boolean) => {
			const drag = dragRef.current
			if (!drag || drag.pointerId !== event.pointerId) return
			consume(event)
			dragRef.current = null
			if (drag.kind === 'point') latest.current.onPointsChange?.(drag.original)
			if (release) releaseDrag(event)
			setDragPreview(null)
			setHoveredCell(null)
			canvas.style.cursor = latest.current.orbitEnabled ? 'grab' : 'default'
		}

		const onPointerUp = (event: PointerEvent) => {
			const drag = dragRef.current
			if (!drag || drag.pointerId !== event.pointerId) return
			consume(event)
			dragRef.current = null
			if (drag.kind === 'add' && !drag.moved) latest.current.onAddCell?.(drag.cell)
			if (drag.kind === 'voxel' && drag.moved && drag.valid && !sameCell(drag.from, drag.target)) {
				latest.current.onMoveCell?.(drag.from, drag.target)
			}
			releaseDrag(event)
			setDragPreview(null)
			updateHover(event)
		}

		const onContextMenu = (event: MouseEvent) => {
			consume(event)
			if (!latest.current.onCellContextMenu) return
			const picked = pick(event)
			if (picked?.meta.kind !== 'voxel') return
			latest.current.onCellContextMenu(picked.meta.cell, {
				clientX: event.clientX,
				clientY: event.clientY,
			})
			setHoveredCell(null)
		}

		const onPointerLeave = () => {
			if (dragRef.current) return
			setHoveredCell(null)
			canvas.style.cursor = latest.current.orbitEnabled ? 'grab' : 'default'
		}
		const onPointerCancel = (event: PointerEvent) => cancelDrag(event, true)
		const onLostPointerCapture = (event: PointerEvent) => cancelDrag(event, false)

		canvas.addEventListener('pointerdown', onPointerDown, true)
		canvas.addEventListener('pointermove', onPointerMove, true)
		canvas.addEventListener('pointerup', onPointerUp, true)
		canvas.addEventListener('pointercancel', onPointerCancel, true)
		canvas.addEventListener('lostpointercapture', onLostPointerCapture, true)
		canvas.addEventListener('contextmenu', onContextMenu, true)
		canvas.addEventListener('pointerleave', onPointerLeave)
		canvas.style.cursor = latest.current.orbitEnabled ? 'grab' : 'default'
		return () => {
			canvas.removeEventListener('pointerdown', onPointerDown, true)
			canvas.removeEventListener('pointermove', onPointerMove, true)
			canvas.removeEventListener('pointerup', onPointerUp, true)
			canvas.removeEventListener('pointercancel', onPointerCancel, true)
			canvas.removeEventListener('lostpointercapture', onLostPointerCapture, true)
			canvas.removeEventListener('contextmenu', onContextMenu, true)
			canvas.removeEventListener('pointerleave', onPointerLeave)
			dragRef.current = null
			canvas.style.cursor = ''
		}
	}, [camera, gl])

	return { hoveredCell, dragPreview }
}
