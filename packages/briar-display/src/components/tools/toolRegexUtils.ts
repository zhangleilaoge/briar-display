import regjsparser from 'regjsparser'

export type RegexFlags = {
	g: boolean
	i: boolean
	m: boolean
	s: boolean
	u: boolean
	y: boolean
	d: boolean
	v: boolean
}

export const DEFAULT_FLAGS: RegexFlags = {
	g: false,
	i: false,
	m: false,
	s: false,
	u: false,
	y: false,
	d: false,
	v: false,
}

export const FLAG_KEYS: (keyof RegexFlags)[] = ['g', 'i', 'm', 's', 'u', 'y', 'd', 'v']

export const FLAG_LABELS: Record<keyof RegexFlags, string> = {
	g: 'global',
	i: 'ignoreCase',
	m: 'multiline',
	s: 'dotAll',
	u: 'unicode',
	y: 'sticky',
	d: 'hasIndices',
	v: 'unicodeSets',
}

const CACHE_KEY = 'briar_tools_regex_cache'

export type RegexCache = {
	pattern: string
	flags: RegexFlags
	testInput: string
}

export function flagsToString(flags: RegexFlags): string {
	return FLAG_KEYS.filter((k) => flags[k]).join('')
}

export function loadCache(): RegexCache {
	try {
		const raw = localStorage.getItem(CACHE_KEY)
		if (!raw) return { pattern: '', flags: { ...DEFAULT_FLAGS }, testInput: '' }
		const parsed = JSON.parse(raw) as Partial<RegexCache>
		return {
			pattern: typeof parsed.pattern === 'string' ? parsed.pattern : '',
			flags: { ...DEFAULT_FLAGS, ...(parsed.flags || {}) },
			testInput: typeof parsed.testInput === 'string' ? parsed.testInput : '',
		}
	} catch {
		return { pattern: '', flags: { ...DEFAULT_FLAGS }, testInput: '' }
	}
}

export function saveCache(cache: RegexCache): void {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
	} catch {
		// ignore quota
	}
}

type AstNode = {
	type: string
	raw?: string
	body?: AstNode[] | [AstNode]
	kind?: string
	behavior?: string
	negative?: boolean
	greedy?: boolean
	min?: number
	max?: number
	codePoint?: number
	value?: string | { value?: string }
	name?: { value?: string } | string
	matchIndex?: number
}

type RRNode =
	| { kind: 'terminal'; label: string; tone?: 'lit' | 'meta' | 'anchor' }
	| { kind: 'sequence'; items: RRNode[] }
	| { kind: 'choice'; label: string; items: RRNode[] }
	| { kind: 'quant'; item: RRNode; text: string; greedy: boolean; skip: boolean; repeat: boolean }
	| { kind: 'group'; label: string; item: RRNode }

const parseFn = (
	regjsparser as unknown as { parse: (s: string, f: string, feat?: object) => AstNode }
).parse

export function parseRegex(pattern: string, flags: string): AstNode {
	return parseFn(pattern, flags, {
		namedGroups: true,
		lookbehind: true,
		unicodePropertyEscape: true,
		unicodeSet: flags.includes('v'),
	})
}
function charLabel(codePoint: number): string {
	if (codePoint === 32) return 'SP'
	if (codePoint === 9) return 'TAB'
	if (codePoint === 10) return 'LF'
	if (codePoint === 13) return 'CR'
	if (codePoint === 0) return 'NUL'
	try {
		return String.fromCodePoint(codePoint)
	} catch {
		return `U+${codePoint.toString(16).toUpperCase()}`
	}
}

function quantLabel(min: number, max: number | undefined): string {
	const openMax =
		max === undefined || max === Number.POSITIVE_INFINITY || Number.isNaN(max as number)
	if (min === 0 && max === 1) return '0 or 1 time'
	if (min === 0 && openMax) return '0+ times'
	if (min === 1 && openMax) return '1+ times'
	if (openMax) return `${min}+ times`
	if (min === max) return min === 1 ? '1 time' : `${min} times`
	return `${min}...${max} times`
}

const BS = String.fromCharCode(92)

function partLabel(node: AstNode): string {
	const t = node.type
	if (t === 'characterClassRange') {
		const n = node as AstNode & { min: AstNode; max: AstNode }
		return `${charLabel(n.min.codePoint || 0)}-${charLabel(n.max.codePoint || 0)}`
	}
	if (t === 'characterClassEscape') return BS + String(node.value || '')
	if (t === 'unicodePropertyEscape') {
		return `${(node.negative ? `${BS}P{` : `${BS}p{`) + String(node.value || '')}}`
	}
	if (t === 'value') return charLabel(node.codePoint || 0)
	return node.raw || '?'
}

function wrapBody(nodes: AstNode[] | undefined): RRNode {
	if (!nodes || nodes.length === 0) return { kind: 'terminal', label: '(empty)', tone: 'meta' }
	if (nodes.length === 1) return astToRR(nodes[0])
	return { kind: 'sequence', items: nodes.map(astToRR) }
}

function astToRR(node: AstNode): RRNode {
	switch (node.type) {
		case 'disjunction':
			return { kind: 'choice', label: 'One of', items: (node.body || []).map((n) => astToRR(n)) }
		case 'alternative':
			return wrapBody(node.body as AstNode[] | undefined)
		case 'group': {
			const body = wrapBody(node.body as AstNode[] | undefined)
			const behavior = node.behavior || 'normal'
			if (behavior === 'normal') {
				const name =
					typeof node.name === 'object' && node.name
						? node.name.value
						: typeof node.name === 'string'
							? node.name
							: undefined
				return { kind: 'group', label: name ? `group "${name}"` : 'capture group', item: body }
			}
			if (behavior === 'ignore') return { kind: 'group', label: 'non-capture', item: body }
			if (behavior === 'lookahead')
				return { kind: 'group', label: 'positive lookahead', item: body }
			if (behavior === 'negativeLookahead')
				return { kind: 'group', label: 'negative lookahead', item: body }
			if (behavior === 'lookbehind')
				return { kind: 'group', label: 'positive lookbehind', item: body }
			if (behavior === 'negativeLookbehind')
				return { kind: 'group', label: 'negative lookbehind', item: body }
			return { kind: 'group', label: behavior, item: body }
		}
		case 'quantifier': {
			const inner = astToRR((node.body as [AstNode])[0])
			const min = node.min ?? 0
			const max = node.max
			let text = quantLabel(min, max)
			if (node.greedy === false) text += ' (lazy)'
			return {
				kind: 'quant',
				item: inner,
				text,
				greedy: node.greedy !== false,
				skip: min === 0,
				repeat: max !== 1,
			}
		}
		case 'characterClass': {
			const parts = (node.body || []).map(partLabel)
			if (parts.length === 0) {
				return { kind: 'terminal', label: node.negative ? '[^]' : '[]', tone: 'meta' }
			}
			return {
				kind: 'choice',
				label: node.negative ? 'None of' : 'One of',
				items: parts.map((p) => ({ kind: 'terminal' as const, label: p, tone: 'lit' as const })),
			}
		}
		case 'characterClassEscape':
			return { kind: 'terminal', label: BS + String(node.value || ''), tone: 'meta' }
		case 'unicodePropertyEscape':
			return {
				kind: 'terminal',
				label: `${(node.negative ? `${BS}P{` : `${BS}p{`) + String(node.value || '')}}`,
				tone: 'meta',
			}
		case 'dot':
			return { kind: 'terminal', label: 'any character', tone: 'meta' }
		case 'anchor': {
			const map: Record<string, string> = {
				start: 'start of line',
				end: 'end of line',
				boundary: 'word boundary',
				'not-boundary': 'non-word boundary',
			}
			return {
				kind: 'terminal',
				label: map[node.kind || ''] || node.raw || 'anchor',
				tone: 'anchor',
			}
		}
		case 'reference': {
			if (node.matchIndex != null) {
				return { kind: 'terminal', label: `ref #${node.matchIndex}`, tone: 'meta' }
			}
			const n =
				typeof node.name === 'object' && node.name
					? node.name.value
					: typeof node.name === 'string'
						? node.name
						: '?'
			return { kind: 'terminal', label: `ref "${n}"`, tone: 'meta' }
		}
		case 'value':
			return { kind: 'terminal', label: charLabel(node.codePoint || 0), tone: 'lit' }
		default:
			return { kind: 'terminal', label: node.raw || node.type, tone: 'meta' }
	}
}

type Box = { w: number; h: number; up: number; down: number }

type Laid =
	| { kind: 'terminal'; label: string; tone: string; box: Box }
	| { kind: 'sequence'; items: Laid[]; box: Box }
	| { kind: 'choice'; label: string; items: Laid[]; box: Box }
	| { kind: 'quant'; item: Laid; text: string; skip: boolean; repeat: boolean; box: Box }
	| { kind: 'group'; label: string; item: Laid; box: Box }

const CHAR_W = 7.2
const PAD_X = 10
const PAD_Y = 6
const GAP = 16

function textWidth(s: string): number {
	return Math.max(12, s.length * CHAR_W)
}

function termBox(label: string): Box {
	const w = textWidth(label) + PAD_X * 2
	const h = 28
	return { w, h, up: h / 2, down: h / 2 }
}

function layout(node: RRNode): Laid {
	switch (node.kind) {
		case 'terminal': {
			const box = termBox(node.label)
			return { kind: 'terminal', label: node.label, tone: node.tone || 'lit', box }
		}
		case 'sequence': {
			const items = node.items.map(layout)
			if (items.length === 0) return layout({ kind: 'terminal', label: '(empty)', tone: 'meta' })
			let w = 0
			let up = 0
			let down = 0
			items.forEach((it, i) => {
				w += it.box.w + (i > 0 ? GAP : 0)
				up = Math.max(up, it.box.up)
				down = Math.max(down, it.box.down)
			})
			return { kind: 'sequence', items, box: { w, h: up + down, up, down } }
		}
		case 'choice': {
			const items = node.items.map(layout)
			const labelW = textWidth(node.label) + 16
			let innerW = 0
			let innerH = 0
			items.forEach((it, i) => {
				innerW = Math.max(innerW, it.box.w)
				innerH += it.box.h + (i > 0 ? 12 : 0)
			})
			const w = Math.max(labelW, innerW + 40) + 24
			const h = innerH + 36
			const up = items.length > 0 ? 28 + items[0].box.up : h / 2
			return { kind: 'choice', label: node.label, items, box: { w, h, up, down: h - up } }
		}
		case 'quant': {
			const item = layout(node.item)
			const tw = textWidth(node.text) + 8
			const w = item.box.w + 36
			const up = item.box.up + 22
			const down = item.box.down + (node.skip ? 24 : 8)
			return {
				kind: 'quant',
				item,
				text: node.text,
				skip: node.skip,
				repeat: node.repeat,
				box: { w: Math.max(w, tw + 20), h: up + down, up, down },
			}
		}
		case 'group': {
			const item = layout(node.item)
			const lw = textWidth(node.label) + 12
			const w = Math.max(item.box.w + 28, lw + 8)
			const up = item.box.up + 26
			const down = item.box.down + 12
			return { kind: 'group', label: node.label, item, box: { w, h: up + down, up, down } }
		}
	}
}

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function tag(name: string, attrs: string, body?: string): string {
	if (body === undefined) return `<${name}${attrs ? ` ${attrs}` : ''}/>`
	return `<${name}${attrs ? ` ${attrs}` : ''}>${body}</${name}>`
}

function toneFill(tone: string): string {
	if (tone === 'meta') return '#eef6ff'
	if (tone === 'anchor') return '#fff4e5'
	return '#ffffff'
}

function drawNode(node: Laid, x: number, cy: number): string {
	const parts: string[] = []
	switch (node.kind) {
		case 'terminal': {
			const y = cy - node.box.up
			const rx = 6
			parts.push(
				tag(
					'rect',
					`x="${x}" y="${y}" width="${node.box.w}" height="${node.box.h}" rx="${rx}" fill="${toneFill(node.tone)}" stroke="#333" stroke-width="1.5"`,
				),
			)
			parts.push(
				tag(
					'text',
					`x="${x + node.box.w / 2}" y="${cy + 4}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#222"`,
					esc(node.label),
				),
			)
			break
		}
		case 'sequence': {
			let cx = x
			node.items.forEach((it, i) => {
				if (i > 0) {
					parts.push(
						tag(
							'line',
							`x1="${cx - GAP}" y1="${cy}" x2="${cx}" y2="${cy}" stroke="#333" stroke-width="1.5"`,
						),
					)
				}
				parts.push(drawNode(it, cx, cy))
				cx += it.box.w + GAP
			})
			break
		}
		case 'choice': {
			const top = cy - node.box.up
			parts.push(
				tag(
					'rect',
					`x="${x}" y="${top}" width="${node.box.w}" height="${node.box.h}" rx="8" fill="#fafafa" stroke="#666" stroke-width="1.25" stroke-dasharray="4 3"`,
				),
			)
			parts.push(
				tag(
					'text',
					`x="${x + 12}" y="${top + 16}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#555"`,
					esc(node.label),
				),
			)
			const railX0 = x + 12
			const railX1 = x + node.box.w - 12
			let iy = top + 28
			const centers: number[] = []
			node.items.forEach((it) => {
				const icy = iy + it.box.up
				centers.push(icy)
				const ix = x + (node.box.w - it.box.w) / 2
				parts.push(
					tag(
						'line',
						`x1="${railX0}" y1="${icy}" x2="${ix}" y2="${icy}" stroke="#333" stroke-width="1.5"`,
					),
				)
				parts.push(
					tag(
						'line',
						`x1="${ix + it.box.w}" y1="${icy}" x2="${railX1}" y2="${icy}" stroke="#333" stroke-width="1.5"`,
					),
				)
				parts.push(drawNode(it, ix, icy))
				iy += it.box.h + 12
			})
			if (centers.length) {
				parts.push(
					tag(
						'line',
						`x1="${railX0}" y1="${centers[0]}" x2="${railX0}" y2="${centers[centers.length - 1]}" stroke="#333" stroke-width="1.5"`,
					),
				)
				parts.push(
					tag(
						'line',
						`x1="${railX1}" y1="${centers[0]}" x2="${railX1}" y2="${centers[centers.length - 1]}" stroke="#333" stroke-width="1.5"`,
					),
				)
				parts.push(
					tag(
						'line',
						`x1="${x}" y1="${cy}" x2="${railX0}" y2="${cy}" stroke="#333" stroke-width="1.5"`,
					),
				)
				parts.push(
					tag(
						'line',
						`x1="${railX1}" y1="${cy}" x2="${x + node.box.w}" y2="${cy}" stroke="#333" stroke-width="1.5"`,
					),
				)
			}
			break
		}
		case 'quant': {
			const ix = x + 18
			parts.push(drawNode(node.item, ix, cy))
			const x0 = x + 8
			const x1 = ix + node.item.box.w + 10
			if (node.repeat) {
				const loopY = cy - node.item.box.up - 12
				parts.push(
					tag(
						'path',
						`d="M ${x0} ${cy} L ${x0} ${loopY + 8} Q ${x0} ${loopY}, ${x0 + 8} ${loopY} L ${x1 - 8} ${loopY} Q ${x1} ${loopY}, ${x1} ${loopY + 8} L ${x1} ${cy}" fill="none" stroke="#333" stroke-width="1.5"`,
					),
				)
			}
			if (node.skip) {
				const bypassY = cy + node.item.box.down + 12
				parts.push(
					tag(
						'path',
						`d="M ${x0} ${cy} L ${x0} ${bypassY - 8} Q ${x0} ${bypassY}, ${x0 + 8} ${bypassY} L ${x1 - 8} ${bypassY} Q ${x1} ${bypassY}, ${x1} ${bypassY - 8} L ${x1} ${cy}" fill="none" stroke="#333" stroke-width="1.5"`,
					),
				)
			}
			parts.push(
				tag(
					'text',
					`x="${(x0 + x1) / 2}" y="${cy - node.item.box.up - 16}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#444"`,
					esc(node.text),
				),
			)
			parts.push(
				tag('line', `x1="${x}" y1="${cy}" x2="${ix}" y2="${cy}" stroke="#333" stroke-width="1.5"`),
			)
			parts.push(
				tag(
					'line',
					`x1="${ix + node.item.box.w}" y1="${cy}" x2="${x + node.box.w}" y2="${cy}" stroke="#333" stroke-width="1.5"`,
				),
			)
			break
		}
		case 'group': {
			const top = cy - node.box.up
			parts.push(
				tag(
					'rect',
					`x="${x}" y="${top}" width="${node.box.w}" height="${node.box.h}" rx="6" fill="#f7f7ff" stroke="#556" stroke-width="1.25"`,
				),
			)
			parts.push(
				tag(
					'text',
					`x="${x + 10}" y="${top + 14}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#445"`,
					esc(node.label),
				),
			)
			const ix = x + (node.box.w - node.item.box.w) / 2
			parts.push(drawNode(node.item, ix, cy))
			break
		}
	}
	return parts.join('')
}

export function renderRailroadSvg(pattern: string, flags: string): string {
	if (!pattern) {
		const empty = layout({ kind: 'terminal', label: '(empty)', tone: 'meta' })
		return finalizeSvg(empty)
	}
	const ast = parseRegex(pattern, flags)
	const rr = astToRR(ast)
	const laid = layout(rr)
	return finalizeSvg(laid)
}

function finalizeSvg(root: Laid): string {
	const pad = 16
	const startW = 20
	const endW = 24
	const contentW = root.box.w
	const width = pad * 2 + startW + GAP + contentW + GAP + endW
	const height = pad * 2 + root.box.h
	const cy = pad + root.box.up
	const x0 = pad
	const contentX = x0 + startW + GAP
	const endX = contentX + contentW + GAP

	const body: string[] = []
	body.push(tag('circle', `cx="${x0 + 8}" cy="${cy}" r="6" fill="#333"`))
	body.push(
		tag(
			'line',
			`x1="${x0 + 14}" y1="${cy}" x2="${contentX}" y2="${cy}" stroke="#333" stroke-width="1.5"`,
		),
	)
	body.push(drawNode(root, contentX, cy))
	body.push(
		tag(
			'line',
			`x1="${contentX + contentW}" y1="${cy}" x2="${endX}" y2="${cy}" stroke="#333" stroke-width="1.5"`,
		),
	)
	body.push(
		tag('circle', `cx="${endX + 8}" cy="${cy}" r="6" fill="none" stroke="#333" stroke-width="2"`),
	)
	body.push(tag('circle', `cx="${endX + 8}" cy="${cy}" r="2.5" fill="#333"`))

	return tag(
		'svg',
		`xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" role="img"`,
		body.join(''),
	)
}

export type MatchHit = {
	index: number
	text: string
	groups: string[]
}

export function testRegex(
	pattern: string,
	flags: string,
	input: string,
): { error?: string; matches: MatchHit[] } {
	if (!pattern) return { matches: [] }
	try {
		const re = new RegExp(pattern, flags)
		const matches: MatchHit[] = []
		if (!flags.includes('g')) {
			const m = re.exec(input)
			if (m) {
				matches.push({
					index: m.index,
					text: m[0],
					groups: m.slice(1).map((g) => (g == null ? '' : String(g))),
				})
			}
			return { matches }
		}
		let guard = 0
		let m = re.exec(input)
		while (m !== null) {
			matches.push({
				index: m.index,
				text: m[0],
				groups: m.slice(1).map((g) => (g == null ? '' : String(g))),
			})
			if (m[0].length === 0) re.lastIndex++
			guard++
			if (guard > 10000) break
			m = re.exec(input)
		}
		return { matches }
	} catch (e) {
		return { error: (e as Error).message, matches: [] }
	}
}
