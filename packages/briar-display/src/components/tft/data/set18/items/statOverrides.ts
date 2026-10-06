// 装备面板修正表（手写，fetch.ts 管线不覆盖）：官方 effects 缺失的字段在此补齐
import type { StatMods } from '../../../engine/statsMods'

export const ITEM_STAT_OVERRIDES: Record<string, StatMods> = {
	// 疾射火炮：+1 攻击距离写在描述里（effects 无 Range 字段）
	TFT_Item_Artifact_RapidFirecannon: { range: 1 },
}
