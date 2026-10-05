// PvE 野怪定义：apiName/中文名/图标取自 CommunityDragon，stats 用官方数据（小兵为自定义）
import type { CombatStats } from '../../engine/types'
import { tftAsset } from '../assets'

export interface MonsterDef {
	apiName: string
	name: string
	icon: string
	stats: Pick<
		CombatStats,
		'maxHp' | 'attackDamage' | 'armor' | 'magicResist' | 'attackSpeed' | 'range'
	>
}

const M = (
	apiName: string,
	name: string,
	icon: string,
	maxHp: number,
	attackDamage: number,
	armor: number,
	magicResist: number,
	attackSpeed: number,
	range: number,
): MonsterDef => ({
	apiName,
	name,
	icon: tftAsset(icon),
	stats: { maxHp, attackDamage, armor, magicResist, attackSpeed, range },
})

export const MONSTERS: MonsterDef[] = [
	M(
		'TFT_PvEMinionMelee',
		'近战小兵',
		'/briar/tft/icons/monsters/tft_minion_mobile.png',
		320,
		26,
		10,
		10,
		0.7,
		1,
	),
	M(
		'TFT_PvEMinionCaster',
		'远程小兵',
		'/briar/tft/icons/monsters/tft_minion_mobile.png',
		240,
		34,
		5,
		5,
		0.7,
		3,
	),
	M(
		'TFT_Krug',
		'石甲虫',
		'/briar/tft/icons/monsters/tft_krug_mobile.png',
		1200,
		110,
		50,
		25,
		0.8,
		1,
	),
	M(
		'TFT_Murkwolf',
		'巨型暗影狼',
		'/briar/tft/icons/monsters/tft_murkwolf_mobile.png',
		1300,
		230,
		15,
		15,
		1,
		1,
	),
	M(
		'TFT_MurkwolfMini',
		'暗影狼',
		'/briar/tft/icons/monsters/tft_murkwolf_mobile.png',
		550,
		135,
		15,
		15,
		1,
		1,
	),
	M(
		'TFT_Razorbeak',
		'深红锋喙鸟',
		'/briar/tft/icons/monsters/tft_razorbeak_mobile.png',
		2400,
		230,
		25,
		25,
		0.8,
		1,
	),
	M(
		'TFT_RazorbeakMini',
		'锋喙鸟',
		'/briar/tft/icons/monsters/tft_razorbeak_mobile.png',
		1450,
		180,
		25,
		25,
		0.8,
		1,
	),
	M(
		'TFT_ElderDragon',
		'远古巨龙',
		'/briar/tft/icons/monsters/tft_elderdragon_mobile.png',
		10000,
		900,
		50,
		50,
		0.8,
		2,
	),
]

export const MONSTER_BY_API = new Map(MONSTERS.map((m) => [m.apiName, m]))

export interface PveSpawn {
	apiName: string
	col: number
	/** 放置行 0..3，0 = 前排（靠中线） */
	row: number
}

const MELEE = 'TFT_PvEMinionMelee'
const CASTER = 'TFT_PvEMinionCaster'

/** 每个 PvE 回合的野怪阵容；5-7/6-7/7-7 巨龙数值由调用方按阶段缩放 */
const PVE_WAVES: Record<string, PveSpawn[]> = {
	'1-2': [
		{ apiName: MELEE, col: 2, row: 0 },
		{ apiName: MELEE, col: 4, row: 0 },
	],
	'1-3': [
		{ apiName: MELEE, col: 2, row: 0 },
		{ apiName: MELEE, col: 4, row: 0 },
		{ apiName: CASTER, col: 3, row: 1 },
	],
	'1-4': [
		{ apiName: MELEE, col: 2, row: 0 },
		{ apiName: MELEE, col: 4, row: 0 },
		{ apiName: CASTER, col: 2, row: 1 },
		{ apiName: CASTER, col: 4, row: 1 },
	],
	'2-7': [
		{ apiName: 'TFT_Krug', col: 1, row: 0 },
		{ apiName: 'TFT_Krug', col: 3, row: 0 },
		{ apiName: 'TFT_Krug', col: 5, row: 0 },
	],
	'3-7': [
		{ apiName: 'TFT_Murkwolf', col: 3, row: 0 },
		{ apiName: 'TFT_MurkwolfMini', col: 1, row: 0 },
		{ apiName: 'TFT_MurkwolfMini', col: 5, row: 0 },
		{ apiName: 'TFT_MurkwolfMini', col: 2, row: 1 },
		{ apiName: 'TFT_MurkwolfMini', col: 4, row: 1 },
	],
	'4-7': [
		{ apiName: 'TFT_Razorbeak', col: 3, row: 0 },
		{ apiName: 'TFT_RazorbeakMini', col: 1, row: 0 },
		{ apiName: 'TFT_RazorbeakMini', col: 5, row: 0 },
		{ apiName: 'TFT_RazorbeakMini', col: 2, row: 1 },
		{ apiName: 'TFT_RazorbeakMini', col: 4, row: 1 },
	],
	'5-7': [{ apiName: 'TFT_ElderDragon', col: 3, row: 0 }],
	'6-7': [{ apiName: 'TFT_ElderDragon', col: 3, row: 0 }],
	'7-7': [{ apiName: 'TFT_ElderDragon', col: 3, row: 0 }],
}

export const pveWaveFor = (stage: number, round: number): PveSpawn[] =>
	PVE_WAVES[`${stage}-${round}`] ?? []

/** Boss 轮数值倍率：5-7 起每阶段 x1.5 */
export const pveStatScale = (stage: number): number => (stage >= 5 ? 1.5 ** (stage - 4) : 1)

/** Stage Tracker 用：该 PvE 回合的代表野怪 */
export const pveWaveIcon = (
	stage: number,
	round: number,
): { icon: string; label: string } | null => {
	const wave = pveWaveFor(stage, round)
	if (wave.length === 0) return null
	const first = MONSTER_BY_API.get(wave[0].apiName)
	if (!first) return null
	const label = wave[0].apiName === MELEE || wave[0].apiName === CASTER ? '小兵' : first.name
	return { icon: first.icon, label }
}
