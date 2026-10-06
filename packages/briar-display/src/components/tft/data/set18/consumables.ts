import { tftAsset } from '../assets'
import { ITEM_BY_API } from './index'
import type { SetItem } from './types'

// 消耗品（拆卸器/重铸器/阿尔法印记）：官方条目 TFT_Consumable_*，拖到棋子上使用，用完即焚
const C = (apiName: string, name: string, desc: string, iconPath?: string): SetItem => ({
	apiName,
	name,
	desc,
	effects: {},
	isComponent: false,
	composition: [],
	icon: tftAsset(iconPath ?? `/briar/tft/icons/items/${apiName}.png`),
})

export const CONSUMABLE_REMOVER = 'TFT_Consumable_ItemRemover'
export const CONSUMABLE_REROLLER = 'TFT_Consumable_ItemReroller'
export const CONSUMABLE_ALPHA_MARK = 'TFT_Consumable_AlphaMark'

export const CONSUMABLES: SetItem[] = [
	C(
		CONSUMABLE_REMOVER,
		'装备拆卸器',
		'用在一位英雄身上即可取下其所有装备。\n[消耗品 - 使用后消失。]',
	),
	C(
		CONSUMABLE_REROLLER,
		'装备重铸器',
		'拆卸所有装备并将它们随机变形为拥有相似类型和品质的全新装备。\n[消耗品 - 使用后消失。]',
	),
	C(
		CONSUMABLE_ALPHA_MARK,
		'阿尔法印记',
		'用在一位【峡谷野怪】身上，解锁其专属霸符增益（详见该棋子技能描述中的霸符段）。\n[消耗品 - 使用后消失。]',
		'/briar/tft/icons/traits/DA_Riftbeast18.png',
	),
]

export const CONSUMABLE_BY_API = new Map(CONSUMABLES.map((c) => [c.apiName, c]))

export const isConsumable = (apiName: string) => CONSUMABLE_BY_API.has(apiName)

/** 普通装备 + 消耗品的统一查表（装备栏/UI 展示用） */
export const anyItemByApi = (apiName: string) =>
	ITEM_BY_API.get(apiName) ?? CONSUMABLE_BY_API.get(apiName)
