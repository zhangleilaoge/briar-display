// 由 packages/briar-scripts/src/tft-set18/fetch.ts 生成，勿手改
import { tftAsset } from '../assets'
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
