// 大元素使拉克丝：卡池只放本体 DA_Lux18_Base；选定羁绊后计数 +2，外观切对应形态变体
import { CHAMPION_BY_API } from '../data/set18'

export const LUX_BASE = 'DA_Lux18_Base'

export const isLux = (apiName: string) =>
	apiName.startsWith('DA_Lux18') || apiName.startsWith('DA_18_Lux')

/** 皮肤变体（非本体）：不进卡池/商店 */
export const isLuxVariant = (apiName: string) => isLux(apiName) && apiName !== LUX_BASE

/** 选定羁绊对应的拉克丝形态变体（无对应形态返回 undefined，保持本体外观） */
export const luxFormOf = (trait: string) =>
	[...CHAMPION_BY_API.values()].find((c) => isLuxVariant(c.apiName) && c.traits.includes(trait))
