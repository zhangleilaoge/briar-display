import { describe, expect, it } from 'bun:test'
import { toArrayBuffer } from './binary'

describe('toArrayBuffer', () => {
	it('reuses a buffer covered by the entire view', () => {
		const bytes = new Uint8Array([1, 2, 3])
		expect(toArrayBuffer(bytes)).toBe(bytes.buffer)
	})

	it('contains only the bytes in a subarray view', () => {
		const bytes = new Uint8Array([9, 1, 2, 9])
		const result = toArrayBuffer(bytes.subarray(1, 3))
		expect(Array.from(new Uint8Array(result))).toEqual([1, 2])
	})

	it('copies shared-backed views into an ArrayBuffer', () => {
		const bytes = new Uint8Array(new SharedArrayBuffer(4))
		bytes.set([9, 1, 2, 9])
		const result = toArrayBuffer(bytes.subarray(1, 3))
		expect(result).toBeInstanceOf(ArrayBuffer)
		expect(Array.from(new Uint8Array(result))).toEqual([1, 2])
	})
})
