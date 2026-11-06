import { describe, expect, test } from 'bun:test'
import {
	DEFAULT_ANCHOR,
	FIXED_TIME_STEP,
	advanceRope,
	createRopeState,
	nudgeRope,
	resetRopeState,
} from './ropePhysics'

describe('hanging tag rope physics', () => {
	test('creates a taut vertical rope with equal segments', () => {
		const state = createRopeState()
		for (let index = 0; index < state.particles.length - 1; index++) {
			const first = state.particles[index].position
			const second = state.particles[index + 1].position
			expect(first.x).toBe(DEFAULT_ANCHOR.x)
			expect(Math.hypot(second.x - first.x, second.y - first.y, second.z - first.z)).toBeCloseTo(
				state.segmentLength,
				8,
			)
		}
	})

	test('keeps the dragged endpoint fixed and preserves segment lengths', () => {
		const state = createRopeState()
		const anchor = { x: DEFAULT_ANCHOR.x + 1.2, y: DEFAULT_ANCHOR.y - 0.25, z: 0 }
		for (let step = 0; step < 180; step++) advanceRope(state, anchor, FIXED_TIME_STEP)
		expect(state.particles[0].position).toEqual(anchor)
		for (let index = 0; index < state.particles.length - 1; index++) {
			const first = state.particles[index].position
			const second = state.particles[index + 1].position
			const distance = Math.hypot(second.x - first.x, second.y - first.y, second.z - first.z)
			expect(Math.abs(distance - state.segmentLength)).toBeLessThan(0.015)
		}
	})

	test('keeps moving after the anchor is released', () => {
		const state = createRopeState()
		const lastIndex = state.particles.length - 1
		const anchor = { ...DEFAULT_ANCHOR }
		for (let step = 0; step < 90; step++) {
			anchor.x = DEFAULT_ANCHOR.x + Math.sin(step / 18) * 0.7
			advanceRope(state, anchor, FIXED_TIME_STEP)
		}
		const beforeRelease = state.particles[lastIndex].position.x
		for (let step = 0; step < 60; step++) advanceRope(state, anchor, FIXED_TIME_STEP)
		expect(Math.abs(state.particles[lastIndex].position.x - beforeRelease)).toBeGreaterThan(0.0001)
	})

	test('a nudge creates motion and reset restores the initial state', () => {
		const state = createRopeState()
		nudgeRope(state)
		advanceRope(state, DEFAULT_ANCHOR, FIXED_TIME_STEP)
		expect(state.particles.at(-1)?.position.x).not.toBe(DEFAULT_ANCHOR.x)
		resetRopeState(state)
		expect(state.particles.at(-1)?.position.x).toBe(DEFAULT_ANCHOR.x)
		expect(state.accumulator).toBe(0)
	})

	test('keeps every particle in the screen plane', () => {
		const state = createRopeState()
		nudgeRope(state, 1.4)
		for (let step = 0; step < 120; step++) {
			advanceRope(
				state,
				{ ...DEFAULT_ANCHOR, x: DEFAULT_ANCHOR.x + Math.sin(step / 15) * 0.6 },
				FIXED_TIME_STEP,
			)
		}
		for (const particle of state.particles) {
			expect(particle.position.z).toBe(0)
			expect(particle.previous.z).toBe(0)
		}
	})
})
