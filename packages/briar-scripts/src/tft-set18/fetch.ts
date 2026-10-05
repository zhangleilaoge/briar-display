import fs from 'fs'
import path from 'path'

/**
 * 云顶之弈 S18「自然之力」数据管线：拉取 communitydragon 全量数据，
 * 生成 briar-display 的 TS 数据文件（棋子/羁绊/装备/技能 archetype 初稿）并下载本地图标。
 *
 * 用法：bun run packages/briar-scripts/src/tft-set18/fetch.ts [--cache /tmp/tft_zh.json]
 * 默认有缓存用缓存，无缓存自动下载到缓存路径。
 */

const DATA_URL = 'https://raw.communitydragon.org/latest/cdragon/tft/zh_cn.json'
const CDN_GAME_BASE = 'https://raw.communitydragon.org/latest/game/'
const SET_KEY = '18'
const GENERATED_HEADER = '// 由 packages/briar-scripts/src/tft-set18/fetch.ts 生成，勿手改\n'
const ICON_CONCURRENCY = 8

const COMPONENT_NAMES = [
	'BFSword',
	'RecurveBow',
	'ChainVest',
	'NegatronCloak',
	'NeedlesslyLargeRod',
	'TearOfTheGoddess',
	'SparringGloves',
	'GiantsBelt',
	'Spatula',
	'FryingPan',
]

const findRepoRoot = (startDir: string) => {
	let currentDir = startDir
	while (true) {
		if (fs.existsSync(path.join(currentDir, 'bun.lock'))) {
			return currentDir
		}
		const parentDir = path.dirname(currentDir)
		if (parentDir === currentDir) {
			return startDir
		}
		currentDir = parentDir
	}
}

const REPO_ROOT = findRepoRoot(import.meta.dir)
const DATA_DIR = path.join(REPO_ROOT, 'packages/briar-display/src/components/tft/data/set18')
const ICON_DIR = path.join(REPO_ROOT, 'packages/briar-display/public/briar/tft/icons')

// ---------- 参数与数据加载 ----------

const args = process.argv.slice(2)
const cacheIdx = args.indexOf('--cache')
const cachePath = cacheIdx >= 0 ? args[cacheIdx + 1] : '/tmp/tft_zh.json'

async function fetchBuf(url: string, timeoutMs = 30000): Promise<Buffer> {
	const ctrl = new AbortController()
	const timer = setTimeout(() => ctrl.abort(), timeoutMs)
	try {
		const res = await fetch(url, { signal: ctrl.signal })
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		const buf = Buffer.from(await res.arrayBuffer())
		if (buf.length === 0) throw new Error('空响应')
		return buf
	} finally {
		clearTimeout(timer)
	}
}

async function loadData(): Promise<any> {
	if (fs.existsSync(cachePath)) {
		console.log(`使用缓存 ${cachePath}`)
		return JSON.parse(fs.readFileSync(cachePath, 'utf8'))
	}
	console.log(`缓存 ${cachePath} 不存在，下载 ${DATA_URL} ...`)
	const buf = await fetchBuf(DATA_URL, 180000)
	fs.writeFileSync(cachePath, buf)
	console.log(`已缓存到 ${cachePath}（${(buf.length / 1024 / 1024).toFixed(1)}MB）`)
	return JSON.parse(buf.toString('utf8'))
}

// ---------- 文本清洗与序列化 ----------

/** 剥标签保留内文，保留 @Var@ 占位符；<br> 与字面 \n 统一为换行 */
function cleanDesc(raw: string): string {
	if (!raw) return ''
	let s = raw
	s = s
		.replace(/\\r\\n/g, '\n')
		.replace(/\\n/g, '\n')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
	s = s.replace(/<br\s*\/?>/gi, '\n')
	s = s.replace(/<[^>]+>/g, '')
	s = s.replace(/\n{3,}/g, '\n\n')
	return s.trim()
}

const round4 = (n: number) => {
	const r = Math.round(n * 10000) / 10000
	return Object.is(r, -0) ? 0 : r
}

const quote = (s: string) =>
	`'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`

const isIdent = (k: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)

/** biome 规则：数组有 ≥2 个元素且每个都是 ≥2 成员的对象/数组字面量时强制展开 */
function mustExpandArray(arr: unknown[]): boolean {
	if (arr.length < 2) return false
	return arr.every((v) => {
		if (Array.isArray(v)) return v.length >= 2
		if (v !== null && typeof v === 'object') return Object.keys(v).length >= 2
		return false
	})
}

/** 单行序列化；触发强制展开或存在无法单行的嵌套时返回 null */
function serInline(value: unknown): string | null {
	if (value === null || value === undefined) return 'null'
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	if (typeof value === 'string') return quote(value)
	if (Array.isArray(value)) {
		if (value.length === 0) return '[]'
		if (mustExpandArray(value)) return null
		const parts = value.map(serInline)
		if (parts.includes(null)) return null
		return `[${parts.join(', ')}]`
	}
	const entries = Object.entries(value as Record<string, unknown>)
	if (entries.length === 0) return '{}'
	const parts = entries.map(([k, v]) => {
		const inlineValue = serInline(v)
		return inlineValue === null ? null : `${isIdent(k) ? k : quote(k)}: ${inlineValue}`
	})
	if (parts.includes(null)) return null
	return `{ ${parts.join(', ')} }`
}

/**
 * 按 biome 风格序列化 JS 值：tab 缩进、单引号、尾逗号。
 * col 为值起始处的显示列（tab 计 indentWidth=2），suffix 为行尾字符（如逗号）。
 */
function ser(value: unknown, level: number, col = 0, suffix = ''): string {
	const tab = '\t'.repeat(level)
	const inner = '\t'.repeat(level + 1)
	if (value === null || value === undefined) return 'null'
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	if (typeof value === 'string') return quote(value)
	const inline = serInline(value)
	if (inline !== null && col + inline.length + suffix.length <= 100) return inline
	if (Array.isArray(value)) {
		const items = value.map((v) => `${inner}${ser(v, level + 1, (level + 1) * 2, ',')},`).join('\n')
		return `[\n${items}\n${tab}]`
	}
	const entries = Object.entries(value as Record<string, unknown>)
	const items = entries
		.map(([k, v]) => {
			const key = isIdent(k) ? k : quote(k)
			const childCol = (level + 1) * 2 + key.length + 2
			return `${inner}${key}: ${ser(v, level + 1, childCol, ',')},`
		})
		.join('\n')
	return `{\n${items}\n${tab}}`
}

function writeGen(rel: string, body: string) {
	const abs = path.join(DATA_DIR, rel)
	fs.mkdirSync(path.dirname(abs), { recursive: true })
	fs.writeFileSync(abs, GENERATED_HEADER + body)
	console.log(`写入 ${path.relative(REPO_ROOT, abs)}`)
}

// ---------- 数据转换 ----------

const normalizeName = (s: string) => s.trim().replace(/\s+/g, '')

function buildChampions(set: any, traitApiByName: Map<string, string>) {
	const playable = set.champions.filter(
		(c: any) => c.cost >= 1 && c.cost <= 5 && c.traits?.length > 0,
	)
	const warnings: string[] = []
	const champions = playable.map((c: any) => {
		const traits: string[] = []
		for (const rawName of c.traits as string[]) {
			const api = traitApiByName.get(normalizeName(rawName))
			if (api) {
				traits.push(api)
			} else {
				warnings.push(`${c.apiName} 的羁绊名无法匹配: "${rawName}"`)
			}
		}
		const stats: Record<string, number> = {}
		for (const [k, v] of Object.entries(c.stats ?? {})) stats[k] = round4(Number(v) || 0)
		const vars: Record<string, number[]> = {}
		for (const variable of c.ability?.variables ?? []) {
			vars[variable.name] = (variable.value ?? []).slice(0, 3).map((n: number) => round4(n))
		}
		return {
			apiName: c.apiName,
			name: c.name,
			cost: c.cost,
			traits,
			stats,
			ability: {
				name: c.ability?.name ?? '',
				desc: cleanDesc(c.ability?.desc ?? ''),
				vars,
			},
			icon: `/briar/tft/icons/champions/${c.apiName}.png`,
		}
	})
	return { champions, warnings }
}

function buildTraits(set: any) {
	return (set.traits as any[]).map((t) => ({
		apiName: t.apiName,
		name: t.name,
		desc: cleanDesc(t.desc ?? ''),
		// cdragon 存在 minUnits 为 null 的档位（如 DA_18_Eclipse），按 1 处理
		breakpoints: (t.effects ?? []).map((e: any) => {
			if (e.minUnits == null)
				console.warn(`警告: ${t.apiName} 存在 minUnits 为 null 的档位，按 1 处理`)
			return e.minUnits ?? 1
		}),
		vars: (t.effects ?? []).map((e: any) => {
			const vars: Record<string, number> = {}
			for (const [k, v] of Object.entries(e.variables ?? {})) vars[k] = round4(Number(v) || 0)
			return vars
		}),
		icon: `/briar/tft/icons/traits/${t.apiName}.png`,
	}))
}

function buildItems(items: any[]) {
	const components = []
	for (const short of COMPONENT_NAMES) {
		const apiName = `TFT_Item_${short}`
		const raw = items.find((i) => i.apiName === apiName)
		if (!raw) {
			console.warn(`散件未找到: ${apiName}`)
			continue
		}
		components.push(toSetItem(raw, true))
	}
	const craftable = items
		.filter((i) => i.apiName?.startsWith('TFT_Item_') && i.composition?.length > 0)
		.map((i) => toSetItem(i, false))
	return { components, craftable }
}

function toSetItem(raw: any, isComponent: boolean) {
	const effects: Record<string, number> = {}
	for (const [k, v] of Object.entries(raw.effects ?? {})) effects[k] = round4(Number(v) || 0)
	return {
		apiName: raw.apiName,
		name: raw.name,
		desc: cleanDesc(raw.desc ?? ''),
		effects,
		isComponent,
		composition: isComponent ? [] : (raw.composition ?? []),
		icon: `/briar/tft/icons/items/${raw.apiName}.png`,
	}
}

type AbilityKind =
	| 'strike'
	| 'aoe'
	| 'heal'
	| 'shield'
	| 'buff'
	| 'dash'
	| 'summon'
	| 'dot'
	| 'transform'

/** 按 desc 关键词粗分 archetype，后续人工精修 */
function classify(desc: string): AbilityKind {
	if (desc.includes('变身')) return 'transform'
	if (desc.includes('召唤')) return 'summon'
	if (/位移|突进|冲刺/.test(desc)) return 'dash'
	if (/持续伤害|灼烧|流血|中毒/.test(desc)) return 'dot'
	if (desc.includes('护盾')) return 'shield'
	if (/治疗|回复|恢复/.test(desc)) return 'heal'
	if (desc.includes('伤害') && /范围|所有敌人/.test(desc)) return 'aoe'
	if (/提升|增益/.test(desc)) return 'buff'
	return 'strike'
}

// ---------- 生成文件 ----------

const TYPES_TS = `export interface ChampionStats {
	armor: number
	attackSpeed: number
	critChance: number
	critMultiplier: number
	damage: number
	hp: number
	initialMana: number
	magicResist: number
	mana: number
	range: number
}

export interface SetAbility {
	name: string
	desc: string
	/** 技能变量，数组前 3 个为 1/2/3 星数值 */
	vars: Record<string, number[]>
}

export interface SetChampion {
	apiName: string
	name: string
	cost: number
	/** 羁绊 apiName 列表 */
	traits: string[]
	stats: ChampionStats
	ability: SetAbility
	icon: string
}

export interface SetTrait {
	apiName: string
	name: string
	desc: string
	/** 各档位最小棋子数 */
	breakpoints: number[]
	/** 与 breakpoints 一一对应，每档位的变量表 */
	vars: Record<string, number>[]
	icon: string
}

export interface SetItem {
	apiName: string
	name: string
	desc: string
	effects: Record<string, number>
	isComponent: boolean
	/** 合成配方（散件 apiName），散件本身为空数组 */
	composition: string[]
	icon: string
}

export type AbilityKind =
	| 'strike'
	| 'aoe'
	| 'heal'
	| 'shield'
	| 'buff'
	| 'dash'
	| 'summon'
	| 'dot'
	| 'transform'

export interface AbilityArchetype {
	kind: AbilityKind
	params: Record<string, number[]>
}
`

function generateFiles(
	champions: any[],
	traits: any[],
	components: any[],
	craftable: any[],
	archetypes: Record<string, { kind: AbilityKind; params: Record<string, number[]> }>,
) {
	writeGen('types.ts', TYPES_TS)

	for (let cost = 1; cost <= 5; cost++) {
		const list = champions.filter((c) => c.cost === cost)
		const body = `import type { SetChampion } from '../types'\n\nexport const COST${cost}: SetChampion[] = ${ser(list, 0)}\n`
		writeGen(`champions/cost${cost}.ts`, body)
	}
	writeGen(
		'champions/index.ts',
		`import type { SetChampion } from '../types'\nimport { COST1 } from './cost1'\nimport { COST2 } from './cost2'\nimport { COST3 } from './cost3'\nimport { COST4 } from './cost4'\nimport { COST5 } from './cost5'\n\nexport const CHAMPIONS: SetChampion[] = [...COST1, ...COST2, ...COST3, ...COST4, ...COST5]\n`,
	)

	writeGen(
		'traits.ts',
		`import type { SetTrait } from './types'\n\nexport const TRAITS: SetTrait[] = ${ser(traits, 0)}\n`,
	)

	writeGen(
		'items/components.ts',
		`import type { SetItem } from '../types'\n\nexport const ITEM_COMPONENTS: SetItem[] = ${ser(components, 0)}\n`,
	)
	const corrupted = craftable.filter((i) => i.apiName.startsWith('TFT_Item_Corrupted'))
	const normalCraftable = craftable.filter((i) => !i.apiName.startsWith('TFT_Item_Corrupted'))
	writeGen(
		'items/craftable.ts',
		`import type { SetItem } from '../types'\n\nexport const CRAFTABLE_ITEMS: SetItem[] = ${ser(normalCraftable, 0)}\n`,
	)
	writeGen(
		'items/corrupted.ts',
		`import type { SetItem } from '../types'\n\nexport const CORRUPTED_ITEMS: SetItem[] = ${ser(corrupted, 0)}\n`,
	)
	writeGen(
		'items/index.ts',
		`import type { SetItem } from '../types'
import { ITEM_COMPONENTS } from './components'
import { CORRUPTED_ITEMS } from './corrupted'
import { CRAFTABLE_ITEMS } from './craftable'

export { ITEM_COMPONENTS }
export const ITEMS: SetItem[] = [...CRAFTABLE_ITEMS, ...CORRUPTED_ITEMS]
`,
	)

	writeGen(
		'abilityMap.ts',
		`import type { AbilityArchetype } from './types'\n\nexport const ABILITY_ARCHETYPES: Record<string, AbilityArchetype> = ${ser(archetypes, 0)}\n`,
	)

	writeGen(
		'index.ts',
		`import { tftAsset } from '../assets'
import { ABILITY_ARCHETYPES } from './abilityMap'
import { CHAMPIONS } from './champions'
import { ITEMS, ITEM_COMPONENTS } from './items'
import { TRAITS } from './traits'
import type { SetChampion, SetItem, SetTrait } from './types'

export { ABILITY_ARCHETYPES, CHAMPIONS, ITEM_COMPONENTS, ITEMS, TRAITS }
export type {
	AbilityArchetype,
	AbilityKind,
	ChampionStats,
	SetAbility,
	SetChampion,
	SetItem,
	SetTrait,
} from './types'

// 图标统一过 CDN 前缀（CI 构建注入，本地回退源站路径）
const withCdnIcon = <T extends { icon: string }>(x: T): T => ({ ...x, icon: tftAsset(x.icon) })

export const CHAMPION_BY_API = new Map<string, SetChampion>(
	CHAMPIONS.map((c) => [c.apiName, withCdnIcon(c)]),
)
export const TRAIT_BY_API = new Map<string, SetTrait>(
	TRAITS.map((t) => [t.apiName, withCdnIcon(t)]),
)
export const ITEM_BY_API = new Map<string, SetItem>(
	[...ITEM_COMPONENTS, ...ITEMS].map((i) => [i.apiName, withCdnIcon(i)]),
)
`,
	)
}

// ---------- 图标下载 ----------

interface IconTask {
	name: string
	dest: string
	/** 候选 URL，按优先级 */
	candidates: string[]
}

const iconUrl = (rel: string) => `${CDN_GAME_BASE}${rel.replace(/\.tex$/i, '.png')}`

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>) {
	let idx = 0
	await Promise.all(
		Array.from({ length: Math.min(ICON_CONCURRENCY, items.length) }, async () => {
			while (idx < items.length) {
				await worker(items[idx++])
			}
		}),
	)
}

async function downloadIcons(tasks: IconTask[]) {
	let downloaded = 0
	let skipped = 0
	let failures: { task: IconTask; errors: string[] }[] = []

	const attempt = async (task: IconTask) => {
		if (fs.existsSync(task.dest) && fs.statSync(task.dest).size > 0) {
			skipped++
			return
		}
		const errors: string[] = []
		for (const url of task.candidates) {
			try {
				const buf = await fetchBuf(url)
				fs.mkdirSync(path.dirname(task.dest), { recursive: true })
				fs.writeFileSync(task.dest, buf)
				downloaded++
				return
			} catch (err) {
				errors.push(`${url} → ${(err as Error).message}`)
			}
		}
		failures.push({ task, errors })
	}

	await runPool(tasks, attempt)

	if (failures.length > 0) {
		console.log(`\n重试 ${failures.length} 个失败图标...`)
		const retrying = failures
		failures = []
		await runPool(
			retrying.map((f) => f.task),
			attempt,
		)
	}

	console.log(`图标: 新下载 ${downloaded}，已存在跳过 ${skipped}，失败 ${failures.length}`)
	for (const f of failures) {
		console.error(`失败: ${f.task.name}`)
		for (const e of f.errors) console.error(`  ${e}`)
	}
	return failures.length
}

// ---------- 主流程 ----------

async function main() {
	const data = await loadData()
	const set = data.sets?.[SET_KEY]
	if (!set) throw new Error(`sets["${SET_KEY}"] 不存在`)

	const traitApiByName = new Map<string, string>()
	for (const t of set.traits as any[]) {
		traitApiByName.set(normalizeName(t.name), t.apiName)
	}

	const { champions, warnings } = buildChampions(set, traitApiByName)
	for (const w of warnings) console.warn(`警告: ${w}`)
	const traits = buildTraits(set)
	const { components, craftable } = buildItems(data.items)

	const archetypes: Record<string, { kind: AbilityKind; params: Record<string, number[]> }> = {}
	for (const c of champions) {
		archetypes[c.apiName] = { kind: classify(c.ability.desc), params: c.ability.vars }
	}

	generateFiles(champions, traits, components, craftable, archetypes)

	const iconTasks: IconTask[] = []
	const rawChampByApi = new Map<string, any>(set.champions.map((c: any) => [c.apiName, c]))
	for (const c of champions) {
		const raw = rawChampByApi.get(c.apiName)!
		const candidates = [raw.tileIcon, raw.squareIcon, raw.icon].filter(Boolean).map(iconUrl)
		iconTasks.push({
			name: c.apiName,
			dest: path.join(ICON_DIR, 'champions', `${c.apiName}.png`),
			candidates,
		})
	}
	for (const t of set.traits as any[]) {
		iconTasks.push({
			name: t.apiName,
			dest: path.join(ICON_DIR, 'traits', `${t.apiName}.png`),
			candidates: [t.icon].filter(Boolean).map(iconUrl),
		})
	}
	const rawItemByApi = new Map<string, any>(data.items.map((i: any) => [i.apiName, i]))
	for (const item of [...components, ...craftable]) {
		const raw = rawItemByApi.get(item.apiName)!
		iconTasks.push({
			name: item.apiName,
			dest: path.join(ICON_DIR, 'items', `${item.apiName}.png`),
			candidates: [raw.icon].filter(Boolean).map(iconUrl),
		})
	}
	const failedIcons = await downloadIcons(iconTasks)

	const dist: Record<number, number> = {}
	for (const c of champions) dist[c.cost] = (dist[c.cost] ?? 0) + 1
	console.log('\n=== 统计 ===')
	console.log(
		`棋子: ${champions.length}（${[1, 2, 3, 4, 5].map((c) => `${c}费${dist[c] ?? 0}`).join(' / ')}）`,
	)
	console.log(`羁绊: ${traits.length}`)
	console.log(`合成装: ${craftable.length}`)
	console.log(`散件: ${components.length}`)
	const junk = craftable.filter((i) => i.name.startsWith('tft_item_name_'))
	if (junk.length > 0) {
		console.log(`未本地化占位装备: ${junk.map((i) => i.apiName).join(', ')}`)
	}
	if (warnings.length > 0) console.log(`羁绊名匹配警告: ${warnings.length} 条`)
	if (failedIcons > 0) process.exit(1)
}

main().catch((err) => {
	console.error('脚本执行失败:', err)
	process.exit(1)
})
