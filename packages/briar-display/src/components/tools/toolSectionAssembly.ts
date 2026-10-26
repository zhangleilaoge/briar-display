import type { Vec3 } from './toolSectionUtils'

export const ASSEMBLY_DURATION = 4000
export const ASSEMBLY_START_OFFSET: Vec3 = [2.5, 1.5, 1.5]

export function assemblyPieceOffset(progress: number): Vec3 {
	const clamped = Math.min(1, Math.max(0, progress))
	const remaining = (1 - clamped) ** 3
	return [
		ASSEMBLY_START_OFFSET[0] * remaining,
		ASSEMBLY_START_OFFSET[1] * remaining,
		ASSEMBLY_START_OFFSET[2] * remaining,
	]
}
