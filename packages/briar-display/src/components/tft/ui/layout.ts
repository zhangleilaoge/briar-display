/** 点顶六边形几何：宽 W、高 H=W/0.866，行错半格（偶数行右移，与引擎 even-r 一致） */
export const HEX_W = 72
export const HEX_H = Math.round(HEX_W / 0.866)

export const hexX = (col: number, row: number) => col * HEX_W + (row % 2 === 0 ? HEX_W / 2 : 0)
export const hexY = (row: number) => row * HEX_H * 0.75

export const BOARD_PIXEL_W = 7 * HEX_W + HEX_W / 2
export const BOARD_PIXEL_H = Math.round(7 * HEX_H * 0.75 + HEX_H)

export const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

/** 费用边框色（1 灰 2 绿 3 蓝 4 紫 5 金） */
export const COST_BORDER = [
	'',
	'border-zinc-400',
	'border-green-500',
	'border-blue-500',
	'border-purple-500',
	'border-amber-400',
]
export const COST_TEXT = [
	'',
	'text-zinc-300',
	'text-green-400',
	'text-blue-400',
	'text-purple-400',
	'text-amber-300',
]
