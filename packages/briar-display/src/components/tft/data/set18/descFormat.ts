/** 官方描述文本清洗：@Var@/@Var*100@ 替换为数值表取值，%i:scaleX% 缩放标记与 {{keyword}} 直接移除 */
export function formatTftDesc(
	desc: string,
	vars?: Record<string, number[] | number>,
	star = 1,
): string {
	return desc
		.replace(/%i:\w+%/g, '')
		.replace(/\{\{\w+\}\}/g, '')
		.replace(/@(\w+?)(\*100)?@/g, (_, name: string, mult: string | undefined) => {
			const raw = vars?.[name]
			const v = Array.isArray(raw) ? (raw[Math.min(star - 1, raw.length - 1)] ?? raw[0]) : raw
			if (typeof v !== 'number') return '—'
			const n = mult ? v * 100 : v
			return String(Math.round(n * 10) / 10)
		})
}

/**
 * 羁绊描述清洗：@MinUnits@ 按断点顺序替换；命名变量直接查表；
 * 哈希变量（{xxxx}）按规则配对——逐断点变化的配给每行重复出现的变量，稀疏键优先配给只出现一次的变量。
 */
export function formatTraitDesc(
	desc: string,
	breakpoints: number[],
	vars?: Array<Record<string, number>>,
): string {
	const named = new Set(
		(vars ?? []).flatMap((r) => Object.keys(r).filter((k) => !k.startsWith('{'))),
	)
	const hashKeys = [
		...new Set((vars ?? []).flatMap((r) => Object.keys(r).filter((k) => k.startsWith('{')))),
	]
	const rows = vars ?? []
	const presentRows = (k: string) => rows.filter((r) => k in r).length
	const variesAcrossRows = (k: string) => new Set(rows.map((r) => r[k])).size > 1
	const perLinePool = hashKeys.filter((k) => presentRows(k) === rows.length && variesAcrossRows(k))
	const sparsePool = hashKeys.filter((k) => presentRows(k) < rows.length)
	const constPool = hashKeys.filter((k) => presentRows(k) === rows.length && !variesAcrossRows(k))
	const globalPool = [...sparsePool, ...constPool]

	const names = [...desc.matchAll(/@(\w+?)(?:\*100)?@/g)]
		.map((m) => m[1])
		.filter((n) => n !== 'MinUnits' && !named.has(n))
	const counts = new Map<string, number>()
	for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
	const order = [...new Set(names)]
	const onceVars = order.filter((n) => counts.get(n) === 1)
	const multiVars = order.filter((n) => (counts.get(n) ?? 0) > 1)
	const assign = new Map<string, string>()
	onceVars.forEach((n, i) => {
		const k = globalPool[i]
		if (k) assign.set(n, k)
	})
	multiVars.forEach((n, i) => {
		const k = perLinePool[i]
		if (k) assign.set(n, k)
	})

	let bpIdx = 0
	const seen = new Map<string, number>()
	return desc
		.replace(/%i:\w+%/g, '')
		.replace(/\{\{\w+\}\}/g, '')
		.replace(/@(\w+?)(\*100)?@/g, (_, name: string, mult: string | undefined) => {
			if (name === 'MinUnits') {
				const bp = breakpoints[Math.min(bpIdx++, breakpoints.length - 1)]
				return bp === undefined ? '—' : String(bp)
			}
			const occ = seen.get(name) ?? 0
			seen.set(name, occ + 1)
			const key = assign.get(name) ?? (named.has(name) ? name : null)
			if (!key) return '—'
			const isPerLine = perLinePool.includes(key) || (named.has(key) && variesAcrossRows(key))
			const row = rows[Math.min(isPerLine ? occ : 0, rows.length - 1)]
			const v = row?.[key] ?? rows.find((r) => key in r)?.[key]
			if (typeof v !== 'number') return '—'
			const n = mult ? v * 100 : v
			return String(Math.round(n * 10) / 10)
		})
}
