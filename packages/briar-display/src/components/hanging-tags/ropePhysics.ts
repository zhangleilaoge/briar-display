export type Vec3 = { x: number; y: number; z: number }

export type RopeParticle = {
	position: Vec3
	previous: Vec3
	inverseMass: number
}

export type RopeState = {
	particles: RopeParticle[]
	segmentLength: number
	accumulator: number
}

export const ROPE_SEGMENT_COUNT = 32
export const ROPE_LENGTH = 7.45
export const DEFAULT_ANCHOR: Vec3 = { x: 0.65, y: 3.25, z: 0 }
export const TAG_ATTACHMENT_INDICES = [5, 14, 23]
export const FIXED_TIME_STEP = 1 / 120

const GRAVITY = 9.81
const DAMPING = 0.968
const CONSTRAINT_ITERATIONS = 14
const MAX_FRAME_TIME = 1 / 20

const copyVector = (vector: Vec3): Vec3 => ({ ...vector })

export function createRopeState(anchor: Vec3 = DEFAULT_ANCHOR): RopeState {
	const segmentLength = ROPE_LENGTH / ROPE_SEGMENT_COUNT
	return {
		segmentLength,
		accumulator: 0,
		particles: Array.from({ length: ROPE_SEGMENT_COUNT + 1 }, (_, index) => {
			const position = {
				x: anchor.x,
				y: anchor.y - index * segmentLength,
				z: anchor.z,
			}
			return {
				position,
				previous: copyVector(position),
				inverseMass: TAG_ATTACHMENT_INDICES.includes(index) ? 0.92 : 1,
			}
		}),
	}
}

export function resetRopeState(state: RopeState, anchor: Vec3 = DEFAULT_ANCHOR) {
	state.accumulator = 0
	state.particles.forEach((particle, index) => {
		particle.position.x = anchor.x
		particle.position.y = anchor.y - index * state.segmentLength
		particle.position.z = anchor.z
		particle.previous = copyVector(particle.position)
	})
}

export function nudgeRope(state: RopeState, strength = 1) {
	const lastIndex = state.particles.length - 1
	state.particles.forEach((particle, index) => {
		if (index === 0) return
		const influence = index / lastIndex
		particle.previous.x -= strength * influence * 0.024
	})
}

function integrate(state: RopeState, timeStep: number) {
	for (let index = 1; index < state.particles.length; index++) {
		const particle = state.particles[index]
		const { position, previous } = particle
		const velocityX = (position.x - previous.x) * DAMPING
		const velocityY = (position.y - previous.y) * DAMPING
		previous.x = position.x
		previous.y = position.y
		previous.z = position.z
		position.x += velocityX
		position.y += velocityY - GRAVITY * timeStep * timeStep
	}
}

function solveConstraints(state: RopeState, anchor: Vec3) {
	const { particles, segmentLength } = state
	for (let iteration = 0; iteration < CONSTRAINT_ITERATIONS; iteration++) {
		particles[0].position.x = anchor.x
		particles[0].position.y = anchor.y
		particles[0].position.z = anchor.z
		for (let index = 0; index < particles.length - 1; index++) {
			const first = particles[index]
			const second = particles[index + 1]
			const deltaX = second.position.x - first.position.x
			const deltaY = second.position.y - first.position.y
			const deltaZ = second.position.z - first.position.z
			const distance = Math.hypot(deltaX, deltaY, deltaZ) || 1
			const correction = (distance - segmentLength) / distance
			const firstWeight = index === 0 ? 0 : first.inverseMass
			const totalWeight = firstWeight + second.inverseMass
			const firstShare = firstWeight / totalWeight
			const secondShare = second.inverseMass / totalWeight
			first.position.x += deltaX * correction * firstShare
			first.position.y += deltaY * correction * firstShare
			first.position.z += deltaZ * correction * firstShare
			second.position.x -= deltaX * correction * secondShare
			second.position.y -= deltaY * correction * secondShare
			second.position.z -= deltaZ * correction * secondShare
		}
	}
	particles[0].position.x = anchor.x
	particles[0].position.y = anchor.y
	particles[0].position.z = anchor.z
}

export function advanceRope(state: RopeState, anchor: Vec3, frameTime: number) {
	state.accumulator += Math.min(Math.max(frameTime, 0), MAX_FRAME_TIME)
	let steps = 0
	while (state.accumulator >= FIXED_TIME_STEP) {
		integrate(state, FIXED_TIME_STEP)
		solveConstraints(state, anchor)
		state.accumulator -= FIXED_TIME_STEP
		steps++
	}
	return steps
}
