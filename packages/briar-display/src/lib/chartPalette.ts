/**
 * 图表（lightweight-charts / 内联 SVG）用的固定色板。
 * Canvas 图表无法直接读取 Tailwind class，这里用十六进制镜像 src/styles/theme.css 中
 * .theme-arcane 的语义 token（行情页属于 Arcane HUD 风格）。改 token 时请同步这里。
 */
export const CHART = {
	/** --danger：上涨（A 股红涨） */
	up: '#b82e39',
	upSoft: 'rgba(184, 46, 57, 0.55)',
	upFillTop: 'rgba(184, 46, 57, 0.18)',
	upFillBottom: 'rgba(184, 46, 57, 0.02)',
	/** --success：下跌（绿跌） */
	down: '#296557',
	downSoft: 'rgba(41, 101, 87, 0.55)',
	downFillTop: 'rgba(41, 101, 87, 0.02)',
	downFillBottom: 'rgba(41, 101, 87, 0.18)',
	/** --muted-foreground */
	text: '#4e607e',
	flat: '#4e607e',
	/** --border（藏青 1px 线） */
	grid: 'rgba(159, 180, 208, 0.28)',
	base: '#9fb4d0',
	/** --warning / --info / --plum */
	warning: '#9a6219',
	info: '#275891',
	plum: '#674f92',
	/** 字体：Arcane 的大写间距无衬线 */
	fontFamily: "'Josefin Sans Variable', 'Josefin Sans', ui-sans-serif, system-ui, sans-serif",
} as const
