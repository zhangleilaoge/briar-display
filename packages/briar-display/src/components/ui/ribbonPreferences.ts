export function normalizeRibbonOrder<T extends string>(
	value: unknown,
	available: readonly T[],
): T[] {
	if (!Array.isArray(value)) return [...available]
	const allowed = new Set(available)
	const selected = new Set<T>()
	const order: T[] = []
	for (const key of value) {
		if (typeof key !== 'string' || !allowed.has(key as T) || selected.has(key as T)) continue
		selected.add(key as T)
		order.push(key as T)
	}
	if (value.length > 0 && order.length === 0) return [...available]
	return order
}

export function moveRibbonItem<T>(items: readonly T[], from: number, to: number): T[] {
	if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
		return [...items]
	}
	const next = [...items]
	const [moved] = next.splice(from, 1)
	next.splice(to, 0, moved)
	return next
}

export function ribbonInsertionIndex(pointerY: number, midpoints: readonly number[]): number {
	const index = midpoints.findIndex((midpoint) => pointerY < midpoint)
	return index === -1 ? midpoints.length : index
}

export function ribbonDragOffset(index: number, from: number, to: number): number {
	if (index === from) return to - from
	if (from < to && index > from && index <= to) return -1
	if (from > to && index >= to && index < from) return 1
	return 0
}
