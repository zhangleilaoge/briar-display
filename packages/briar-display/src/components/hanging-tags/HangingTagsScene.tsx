import { RoundedBox } from '@react-three/drei'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ThreadedRing } from './ThreadedRing'
import {
	DEFAULT_ANCHOR,
	FIXED_TIME_STEP,
	ROPE_SEGMENT_COUNT,
	TAG_ATTACHMENT_INDICES,
	type Vec3,
	advanceRope,
	createRopeState,
	nudgeRope,
	resetRopeState,
} from './ropePhysics'

const TAGS = [
	{ number: '01', title: 'STILL', subtitle: '静止，也在流动', color: '#ded5c6', ink: '#39372f' },
	{ number: '02', title: 'DRIFT', subtitle: '随一点风偏移', color: '#bdcdd0', ink: '#293b3e' },
	{ number: '03', title: 'SOFT', subtitle: '轻轻地落回来', color: '#d6bcb3', ink: '#49332e' },
]

const TAG_HEIGHT = 1.44
const UP = new THREE.Vector3(0, 1, 0)
const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(maximum, Math.max(minimum, value))

function roundedRectangle(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	context.beginPath()
	context.moveTo(x + radius, y)
	context.lineTo(x + width - radius, y)
	context.quadraticCurveTo(x + width, y, x + width, y + radius)
	context.lineTo(x + width, y + height - radius)
	context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
	context.lineTo(x + radius, y + height)
	context.quadraticCurveTo(x, y + height, x, y + height - radius)
	context.lineTo(x, y + radius)
	context.quadraticCurveTo(x, y, x + radius, y)
	context.closePath()
}

function makeTagTexture(tag: (typeof TAGS)[number]) {
	const canvas = document.createElement('canvas')
	canvas.width = 512
	canvas.height = 640
	const context = canvas.getContext('2d')
	if (!context) return new THREE.CanvasTexture(canvas)
	roundedRectangle(context, 5, 5, 502, 630, 34)
	context.fillStyle = tag.color
	context.fill()
	context.strokeStyle = `${tag.ink}38`
	context.lineWidth = 2
	context.stroke()
	context.fillStyle = tag.ink
	context.font = '22px monospace'
	context.fillText(`OBJECT / ${tag.number}`, 46, 128)
	context.fillRect(46, 159, 420, 1)
	context.font = '64px Georgia, serif'
	context.fillText(tag.title, 42, 344)
	context.font = '24px sans-serif'
	context.fillText(tag.subtitle, 46, 399)
	context.font = '16px monospace'
	context.fillText('HANGING STUDIES', 46, 566)
	context.textAlign = 'right'
	context.fillText('BRIAR®', 466, 566)
	context.textAlign = 'left'
	context.beginPath()
	context.arc(256, 65, 20, 0, Math.PI * 2)
	context.fillStyle = '#504c43'
	context.fill()
	context.beginPath()
	context.arc(256, 65, 11, 0, Math.PI * 2)
	context.fillStyle = '#252621'
	context.fill()
	const texture = new THREE.CanvasTexture(canvas)
	texture.colorSpace = THREE.SRGBColorSpace
	texture.anisotropy = 8
	return texture
}

function TagFace({ tag }: { tag: (typeof TAGS)[number] }) {
	const texture = useMemo(() => makeTagTexture(tag), [tag])
	useEffect(() => () => texture.dispose(), [texture])
	return (
		<>
			<RoundedBox
				args={[1.36, TAG_HEIGHT, 0.07]}
				radius={0.034}
				smoothness={4}
				position={[0, 0.12 - TAG_HEIGHT / 2, 0]}
				castShadow
				receiveShadow
			>
				<meshStandardMaterial color={tag.color} roughness={0.82} />
			</RoundedBox>
			<mesh position={[0, 0.12 - TAG_HEIGHT / 2, 0.041]}>
				<planeGeometry args={[1.36, TAG_HEIGHT]} />
				<meshStandardMaterial map={texture} transparent roughness={0.85} />
			</mesh>
			<mesh position={[0, 0, 0.065]} rotation={[0, 0, 0]}>
				<torusGeometry args={[0.055, 0.012, 10, 32]} />
				<meshStandardMaterial color="#777a75" metalness={0.88} roughness={0.25} />
			</mesh>
		</>
	)
}

function CameraSetup() {
	const camera = useThree((state) => state.camera)
	const size = useThree((state) => state.size)
	useEffect(() => {
		camera.position.set(0, 0.05, size.width / size.height < 0.72 ? 16.5 : 13)
		camera.lookAt(0, 0, 0)
		camera.updateProjectionMatrix()
	}, [camera, size])
	return null
}

type WorldProps = {
	resetKey: number
	nudgeKey: number
	onDraggingChange: (dragging: boolean) => void
}

function HangingWorld({ resetKey, nudgeKey, onDraggingChange }: WorldProps) {
	const gl = useThree((state) => state.gl)
	const simulation = useRef(createRopeState())
	const anchor = useRef<Vec3>({ ...DEFAULT_ANCHOR })
	const dragging = useRef(false)
	const dragOffset = useRef(new THREE.Vector3())
	const handleRef = useRef<THREE.Group>(null)
	const segmentRefs = useRef<(THREE.Mesh | null)[]>([])
	const ringRefs = useRef<(THREE.Group | null)[]>([])
	const tagRefs = useRef<(THREE.Group | null)[]>([])
	const dynamics = useRef(TAGS.map(() => ({ angle: 0, velocity: 0 })))
	const hoverTargets = useRef(TAGS.map(() => 0))
	const hoverForces = useRef(TAGS.map(() => 0))
	const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])
	const hitPoint = useMemo(() => new THREE.Vector3(), [])
	const start = useMemo(() => new THREE.Vector3(), [])
	const end = useMemo(() => new THREE.Vector3(), [])
	const direction = useMemo(() => new THREE.Vector3(), [])

	useEffect(() => {
		anchor.current = { ...DEFAULT_ANCHOR }
		resetRopeState(simulation.current, anchor.current)
		for (const dynamic of dynamics.current) {
			dynamic.angle = 0
			dynamic.velocity = 0
		}
	}, [resetKey])

	useEffect(() => {
		if (nudgeKey > 0) nudgeRope(simulation.current)
	}, [nudgeKey])

	useEffect(
		() => () => {
			gl.domElement.style.cursor = ''
		},
		[gl],
	)

	useFrame((_, frameTime) => {
		const state = simulation.current
		advanceRope(state, anchor.current, frameTime)
		const particles = state.particles
		for (let index = 0; index < ROPE_SEGMENT_COUNT; index++) {
			const mesh = segmentRefs.current[index]
			if (!mesh) continue
			const first = particles[index].position
			const second = particles[index + 1].position
			start.set(first.x, first.y, first.z)
			end.set(second.x, second.y, second.z)
			direction.copy(end).sub(start)
			mesh.position.copy(start).add(end).multiplyScalar(0.5)
			mesh.scale.set(1, direction.length(), 1)
			mesh.quaternion.setFromUnitVectors(UP, direction.normalize())
		}
		TAG_ATTACHMENT_INDICES.forEach((particleIndex, index) => {
			const ring = ringRefs.current[index]
			const tag = tagRefs.current[index]
			if (!ring || !tag) return
			const particle = particles[particleIndex]
			const above = particles[particleIndex - 1].position
			const below = particles[particleIndex + 1].position
			const ropeAngle = Math.atan2(below.x - above.x, -(below.y - above.y))
			const velocityX = (particle.position.x - particle.previous.x) / FIXED_TIME_STEP
			const dynamic = dynamics.current[index]
			const timeStep = Math.min(frameTime, 1 / 30)
			const hoverForce = hoverForces.current[index]
			const nextHoverForce =
				hoverForce + (hoverTargets.current[index] - hoverForce) * Math.min(1, timeStep * 9)
			hoverForces.current[index] = nextHoverForce
			const targetAngle = clamp(
				ropeAngle * 0.32 + velocityX * 0.014 + nextHoverForce * 0.17,
				-0.28,
				0.34,
			)
			dynamic.velocity += ((targetAngle - dynamic.angle) * 32 - dynamic.velocity * 6.2) * timeStep
			dynamic.angle = clamp(dynamic.angle + dynamic.velocity * timeStep, -0.3, 0.34)
			ring.position.set(particle.position.x, particle.position.y, 0)
			ring.rotation.set(0, 0, clamp(ropeAngle * 0.58 + nextHoverForce * 0.1, -0.4, 0.4))
			tag.position.set(particle.position.x, particle.position.y - 0.42, 0.025)
			tag.rotation.set(0, 0, dynamic.angle)
		})
		handleRef.current?.position.set(anchor.current.x, anchor.current.y, anchor.current.z)
	})

	const finishDragging = (event?: ThreeEvent<PointerEvent>) => {
		if (!dragging.current) return
		if (event) {
			const target = event.target as HTMLElement | null
			if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
		}
		dragging.current = false
		onDraggingChange(false)
		gl.domElement.style.cursor = 'grab'
	}

	const moveAnchor = (event: ThreeEvent<PointerEvent>) => {
		if (!dragging.current || !event.ray.intersectPlane(dragPlane, hitPoint)) return
		event.stopPropagation()
		anchor.current.x = clamp(hitPoint.x + dragOffset.current.x, -2.15, 3.25)
		anchor.current.y = clamp(hitPoint.y + dragOffset.current.y, 2.35, 3.65)
	}

	return (
		<>
			<CameraSetup />
			<ambientLight intensity={1.35} />
			<directionalLight
				position={[-4, 7, 8]}
				intensity={2.4}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-camera-left={-6}
				shadow-camera-right={6}
				shadow-camera-top={6}
				shadow-camera-bottom={-6}
				shadow-bias={-0.0003}
			/>
			<directionalLight position={[5, 1, 4]} intensity={0.65} color="#dbe6e7" />
			<mesh position={[0, 0, -1.3]} receiveShadow>
				<planeGeometry args={[30, 20]} />
				<meshStandardMaterial color="#e7e2d9" roughness={1} />
			</mesh>
			{Array.from({ length: ROPE_SEGMENT_COUNT }, (_, index) => (
				<mesh
					key={index}
					ref={(node) => {
						segmentRefs.current[index] = node
					}}
					castShadow
				>
					<cylinderGeometry args={[0.032, 0.035, 1, 8]} />
					<meshStandardMaterial color="#76644d" roughness={0.96} />
				</mesh>
			))}
			{TAGS.map((tag, index) => (
				<group key={tag.number}>
					<group
						ref={(node) => {
							ringRefs.current[index] = node
						}}
					>
						<ThreadedRing />
						<mesh position={[0, -0.29, 0]} castShadow>
							<torusGeometry args={[0.1, 0.022, 10, 32]} />
							<meshStandardMaterial color="#737874" metalness={0.9} roughness={0.24} />
						</mesh>
					</group>
					<group
						ref={(node) => {
							tagRefs.current[index] = node
						}}
						onPointerOver={(event) => {
							event.stopPropagation()
							hoverTargets.current[index] = 1
							if (!dragging.current) gl.domElement.style.cursor = 'pointer'
						}}
						onPointerOut={() => {
							hoverTargets.current[index] = 0
							if (!dragging.current) gl.domElement.style.cursor = ''
						}}
					>
						<TagFace tag={tag} />
					</group>
				</group>
			))}
			<group
				ref={handleRef}
				onPointerDown={(event) => {
					event.stopPropagation()
					const target = event.target as HTMLElement | null
					target?.setPointerCapture(event.pointerId)
					dragging.current = true
					dragOffset.current
						.set(anchor.current.x, anchor.current.y, anchor.current.z)
						.sub(event.point)
					onDraggingChange(true)
					gl.domElement.style.cursor = 'grabbing'
				}}
				onPointerMove={moveAnchor}
				onPointerUp={finishDragging}
				onPointerCancel={finishDragging}
				onPointerOver={() => {
					if (!dragging.current) gl.domElement.style.cursor = 'grab'
				}}
				onPointerOut={() => {
					if (!dragging.current) gl.domElement.style.cursor = ''
				}}
			>
				<mesh castShadow>
					<sphereGeometry args={[0.115, 24, 24]} />
					<meshStandardMaterial color="#9a8054" metalness={0.75} roughness={0.3} />
				</mesh>
				<mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
					<torusGeometry args={[0.14, 0.028, 10, 36]} />
					<meshStandardMaterial color="#9a8054" metalness={0.75} roughness={0.3} />
				</mesh>
				<mesh>
					<sphereGeometry args={[0.34, 16, 16]} />
					<meshBasicMaterial transparent opacity={0} depthWrite={false} />
				</mesh>
			</group>
		</>
	)
}

export default function HangingTagsScene(props: WorldProps) {
	return (
		<Canvas
			className="hanging-tags__canvas"
			camera={{ position: [0, 0.05, 13], fov: 36, near: 0.1, far: 60 }}
			dpr={[1, 2]}
			shadows
			gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
		>
			<color attach="background" args={['#e7e2d9']} />
			<HangingWorld {...props} />
		</Canvas>
	)
}
