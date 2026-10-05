'use client'

export type DragPayload = { kind: 'unit'; uid: string } | { kind: 'item'; itemApi: string }

export type DropTarget =
	| { kind: 'hex'; col: number; row: number }
	| { kind: 'bench'; index: number }
	| { kind: 'sell' }
	| { kind: 'none' }

export interface DragState {
	payload: DragPayload
	x: number
	y: number
}

/** pointer 拖拽：target 通过 elementFromPoint 的 data-* 标记解析 */
export function resolveDropTarget(x: number, y: number): DropTarget {
	const el = document.elementFromPoint(x, y)
	if (!(el instanceof Element)) return { kind: 'none' }
	const hex = el.closest('[data-hex-col]')
	if (hex) {
		return {
			kind: 'hex',
			col: Number(hex.getAttribute('data-hex-col')),
			row: Number(hex.getAttribute('data-hex-row')),
		}
	}
	const bench = el.closest('[data-bench-index]')
	if (bench) return { kind: 'bench', index: Number(bench.getAttribute('data-bench-index')) }
	if (el.closest('[data-sell-zone]')) return { kind: 'sell' }
	return { kind: 'none' }
}
