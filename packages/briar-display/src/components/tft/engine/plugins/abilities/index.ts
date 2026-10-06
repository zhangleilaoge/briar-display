import type { AbilityPlugin } from '../types'
import { COST1_ABILITIES } from './cost1'
import { COST2_ABILITIES } from './cost2'
import { COST3_ABILITIES } from './cost3'
import { COST4_ABILITIES } from './cost4'
import { COST5_ABILITIES } from './cost5'
import { MONSTER_ABILITIES } from './monsters'

/** 棋子技能插件注册表：apiName → 插件；未注册的走通用原型（combat genericCast） */
export const ABILITY_PLUGINS = new Map<string, AbilityPlugin>([
	...Object.entries(COST1_ABILITIES),
	...Object.entries(COST2_ABILITIES),
	...Object.entries(COST3_ABILITIES),
	...Object.entries(COST4_ABILITIES),
	...Object.entries(COST5_ABILITIES),
	...Object.entries(MONSTER_ABILITIES),
])
