import type { TraitPluginFactory } from '../types'
import { adaptor, aluneMoon, fae, lunar, zyraPlants } from './auras'
import { caustic, executioner, floraFatalis, inferno } from './burnShred'
import { rival } from './economy'
import {
	battlemage,
	hunter,
	maokaiStack,
	rapidfire,
	riftbeastGrowth,
	spellweaver,
} from './stacking'
import { elderwood, sprykin, summoner } from './summons'
import { eclipse, slayer, solar, vanguard } from './teamEvents'

/**
 * 羁绊战斗机制插件：按羁绊 apiName 注册，每场战斗实例化一次。
 * params 为该羁绊当前档位的官方变量（data/set18/traits.ts vars）。
 * 纯数值羁绊（神谕/主宰/斗士/护卫/灵魂莲华等）由 traitEffects.ts 静态面板结算，不在此列；
 * 经济/商店/备战类机制（魔女精粹/野兽之灵赐福/翠神种子/宝石配对/德莱文悬赏/大元素使转换）由 gameLoop 处理。
 */
export const TRAIT_PLUGINS: Record<string, TraitPluginFactory> = {
	DA_18_Inferno: inferno,
	DA_18_Caustic: caustic,
	DA_18_Executioner: executioner,
	DA_FloraFatalis18: floraFatalis,
	DA_18_Spellweaver: spellweaver,
	DA_18_Rapidfire: rapidfire,
	DA_18_Hunter: hunter,
	DA_18_Battlemage: battlemage,
	DA_18_Maokai_UniqueTrait: maokaiStack,
	DA_Riftbeast18: riftbeastGrowth,
	DA_18_Lunar: lunar,
	DA_18_Adaptor: adaptor,
	DA_18_ZyraUniqueTrait: zyraPlants,
	DA_AluneUniqueTrait18: aluneMoon,
	DA_18_Fae: fae,
	DA_18_Eclipse: eclipse,
	DA_18_Solar: solar,
	DA_18_Vanguard: vanguard,
	DA_18_Slayer: slayer,
	DA_18_Elderwood: elderwood,
	DA_18_Sprykin: sprykin,
	DA_18_Summoner: summoner,
	DA_18_Rival: rival,
}
