/**
 * 门户 / 想法页共用贴纸库：HermesAgent 级华丽神话/古典繁复线稿。
 * 仅黑白线稿（可白描边）；严禁彩色；剔纯黑实心剪影与低质简陋素材；同 MD5 副本只留一枚。每屏最多 3 枚且互不相交。
 * 每次 ScrapStickerDecor 随机抽几枚，同屏 id / 视觉族不重复。
 */
import abbey from '@/assets/decor/portal/abbey.svg'
import abstractFloral from '@/assets/decor/portal/abstract-floral.svg'
import antiqueKey from '@/assets/decor/portal/antique-key.svg'
import astrolabePsf from '@/assets/decor/portal/astrolabe-psf.svg'
import caduceus from '@/assets/decor/portal/caduceus.svg'
import candle from '@/assets/decor/portal/candle.svg'
import caryatidScroll from '@/assets/decor/portal/caryatid-scroll.svg'
import castorBean from '@/assets/decor/portal/castor-bean.svg'
import cattail from '@/assets/decor/portal/cattail.svg'
import compassRose from '@/assets/decor/portal/compass-rose.svg'
import floral1913 from '@/assets/decor/portal/floral-1913.svg'
import floralRound from '@/assets/decor/portal/floral-round.svg'
import floralSecession from '@/assets/decor/portal/floral-secession.svg'
import flowerPsf from '@/assets/decor/portal/flower-psf.svg'
import gothicArch from '@/assets/decor/portal/gothic-arch.svg'
import greekTemple from '@/assets/decor/portal/greek-temple.svg'
import grotesqueLeft from '@/assets/decor/portal/grotesque-left.svg'
import grotesqueRight from '@/assets/decor/portal/grotesque-right.svg'
import ionicColumn from '@/assets/decor/portal/ionic-column.svg'
import lantern from '@/assets/decor/portal/lantern.svg'
import laurelWreath from '@/assets/decor/portal/laurel-wreath.svg'
import lilienFloral from '@/assets/decor/portal/lilien-floral.svg'
import paperScroll from '@/assets/decor/portal/paper-scroll.svg'
import quill from '@/assets/decor/portal/quill.svg'
import scissors from '@/assets/decor/portal/scissors.svg'
import serratedLeaf from '@/assets/decor/portal/serrated-leaf.svg'
import zakhrafaGreek from '@/assets/decor/portal/zakhrafa-greek.svg'

function srcOf(m: string | { src: string }): string {
	return typeof m === 'string' ? m : m.src
}

export type ScrapStickerKind = 'tall' | 'square' | 'wide'

/** 视觉族：同屏最多一枚，避免两朵花 / 两根柱看起来「重复」 */
export type ScrapStickerFamily =
	| 'column'
	| 'arch'
	| 'lantern'
	| 'floral'
	| 'instrument'
	| 'tool'
	| 'scroll'
	| 'botanical'
	| 'mythic'
	| 'ornament'
	| 'grotesque'
	| 'temple'

export type ScrapSticker = {
	id: string
	src: string
	kind: ScrapStickerKind
	family: ScrapStickerFamily
}

/** @deprecated 用 SCRAP_STICKER_CATALOG */
export type PortalStickerKind = ScrapStickerKind
/** @deprecated */
export type PortalSticker = ScrapSticker

export const SCRAP_STICKER_CATALOG: ScrapSticker[] = [
	{ id: 'ionic-column', src: srcOf(ionicColumn), kind: 'tall', family: 'column' },
	{ id: 'gothic-arch', src: srcOf(gothicArch), kind: 'tall', family: 'arch' },
	{ id: 'lantern', src: srcOf(lantern), kind: 'tall', family: 'lantern' },
	{ id: 'floral-secession', src: srcOf(floralSecession), kind: 'wide', family: 'floral' },
	{ id: 'floral-1913', src: srcOf(floral1913), kind: 'square', family: 'floral' },
	{ id: 'lilien-floral', src: srcOf(lilienFloral), kind: 'wide', family: 'floral' },
	{ id: 'floral-round', src: srcOf(floralRound), kind: 'square', family: 'floral' },
	{ id: 'abstract-floral', src: srcOf(abstractFloral), kind: 'square', family: 'floral' },
	{ id: 'scissors', src: srcOf(scissors), kind: 'wide', family: 'tool' },
	{ id: 'compass-rose', src: srcOf(compassRose), kind: 'square', family: 'ornament' },
	{ id: 'flower-psf', src: srcOf(flowerPsf), kind: 'square', family: 'floral' },
	{ id: 'antique-key', src: srcOf(antiqueKey), kind: 'tall', family: 'tool' },
	{ id: 'greek-temple', src: srcOf(greekTemple), kind: 'wide', family: 'temple' },
	{ id: 'zakhrafa-greek', src: srcOf(zakhrafaGreek), kind: 'wide', family: 'ornament' },
	{ id: 'caryatid-scroll', src: srcOf(caryatidScroll), kind: 'tall', family: 'scroll' },
	{ id: 'grotesque-left', src: srcOf(grotesqueLeft), kind: 'tall', family: 'grotesque' },
	{ id: 'grotesque-right', src: srcOf(grotesqueRight), kind: 'tall', family: 'grotesque' },
	{ id: 'laurel-wreath', src: srcOf(laurelWreath), kind: 'square', family: 'ornament' },
	{ id: 'abbey', src: srcOf(abbey), kind: 'wide', family: 'temple' },
	{ id: 'quill', src: srcOf(quill), kind: 'tall', family: 'tool' },
	{ id: 'caduceus', src: srcOf(caduceus), kind: 'tall', family: 'mythic' },
	{ id: 'paper-scroll', src: srcOf(paperScroll), kind: 'wide', family: 'scroll' },
	{ id: 'candle', src: srcOf(candle), kind: 'tall', family: 'mythic' },
	{ id: 'serrated-leaf', src: srcOf(serratedLeaf), kind: 'tall', family: 'botanical' },
	{ id: 'cattail', src: srcOf(cattail), kind: 'tall', family: 'botanical' },
	{ id: 'astrolabe-psf', src: srcOf(astrolabePsf), kind: 'square', family: 'ornament' },
	{ id: 'castor-bean', src: srcOf(castorBean), kind: 'tall', family: 'botanical' },
]

/** 已剔除（剪影 / 低质 / 重复 / 彩色）：butterfly-black, papillon, fleur-de-lis, ankh,
 * wax-seal, flower-ornament-black, corinthian-helmet, retro-flower, olive-branch,
 * doric-temple(=ionic-column-2), abstract-floral-1913(=floral-1913),
 * everybody-floral(=floral-round), floral-lilien(=lilien-floral),
 * amphora(#ff0000), lyre(#CD9133)
 */

/** @deprecated */
export const PORTAL_STICKER_CATALOG = SCRAP_STICKER_CATALOG
