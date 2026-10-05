/** mulberry32 种子随机：headless 对局可复现 */
export interface Rng {
	next(): number
	/** [0, n) 整数 */
	int(n: number): number
	pick<T>(arr: readonly T[]): T
	shuffle<T>(arr: readonly T[]): T[]
}

export function makeRng(seed: number): Rng {
	let s = seed >>> 0
	const next = () => {
		s |= 0
		s = (s + 0x6d2b79f5) | 0
		let t = Math.imul(s ^ (s >>> 15), 1 | s)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
	return {
		next,
		int(n) {
			return Math.floor(next() * n)
		},
		pick(arr) {
			return arr[Math.floor(next() * arr.length)]
		},
		shuffle(arr) {
			const a = [...arr]
			for (let i = a.length - 1; i > 0; i--) {
				const j = Math.floor(next() * (i + 1))
				;[a[i], a[j]] = [a[j], a[i]]
			}
			return a
		},
	}
}
