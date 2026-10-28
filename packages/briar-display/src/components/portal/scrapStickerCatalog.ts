import abbey from '@/assets/decor/portal/abbey.svg'
import abstractFloral1913 from '@/assets/decor/portal/abstract-floral-1913.svg'
import abstractFloral from '@/assets/decor/portal/abstract-floral.svg'
import amphora from '@/assets/decor/portal/amphora.svg'
import ankh from '@/assets/decor/portal/ankh.svg'
import antiqueKey from '@/assets/decor/portal/antique-key.svg'
import astrolabePsf from '@/assets/decor/portal/astrolabe-psf.svg'
import butterflyBlack from '@/assets/decor/portal/butterfly-black.svg'
import caduceus from '@/assets/decor/portal/caduceus.svg'
import candle from '@/assets/decor/portal/candle.svg'
import caryatidScroll from '@/assets/decor/portal/caryatid-scroll.svg'
import castorBean from '@/assets/decor/portal/castor-bean.svg'
import cattail from '@/assets/decor/portal/cattail.svg'
import compassRose from '@/assets/decor/portal/compass-rose.svg'
import corinthianHelmet from '@/assets/decor/portal/corinthian-helmet.svg'
import doricTemple from '@/assets/decor/portal/doric-temple.svg'
import everybodyFloral from '@/assets/decor/portal/everybody-floral.svg'
import fleurDeLis from '@/assets/decor/portal/fleur-de-lis.svg'
import floral1913 from '@/assets/decor/portal/floral-1913.svg'
import floralLilien from '@/assets/decor/portal/floral-lilien.svg'
import floralRound from '@/assets/decor/portal/floral-round.svg'
import floralSecession from '@/assets/decor/portal/floral-secession.svg'
import flowerOrnamentBlack from '@/assets/decor/portal/flower-ornament-black.svg'
import flowerPsf from '@/assets/decor/portal/flower-psf.svg'
import gothicArch from '@/assets/decor/portal/gothic-arch.svg'
import greekTemple from '@/assets/decor/portal/greek-temple.svg'
import grotesqueLeft from '@/assets/decor/portal/grotesque-left.svg'
import grotesqueRight from '@/assets/decor/portal/grotesque-right.svg'
import ionicColumn2 from '@/assets/decor/portal/ionic-column-2.svg'
/**
 * 门户 / 想法页共用贴纸库：HermesAgent 风黑白古典线稿 / 剪纸。
 * 仅单色（黑白）；彩色素材不进池。每次 ScrapStickerDecor 随机抽几枚。
 */
import ionicColumn from '@/assets/decor/portal/ionic-column.svg'
import lantern from '@/assets/decor/portal/lantern.svg'
import laurelWreath from '@/assets/decor/portal/laurel-wreath.svg'
import lilienFloral from '@/assets/decor/portal/lilien-floral.svg'
import lyre from '@/assets/decor/portal/lyre.svg'
import oliveBranch from '@/assets/decor/portal/olive-branch.svg'
import paperScroll from '@/assets/decor/portal/paper-scroll.svg'
import papillon from '@/assets/decor/portal/papillon.svg'
import quill from '@/assets/decor/portal/quill.svg'
import retroFlower from '@/assets/decor/portal/retro-flower.svg'
import scissors from '@/assets/decor/portal/scissors.svg'
import serratedLeaf from '@/assets/decor/portal/serrated-leaf.svg'
import waxSeal from '@/assets/decor/portal/wax-seal.svg'
import zakhrafaGreek from '@/assets/decor/portal/zakhrafa-greek.svg'

function srcOf(m: string | { src: string }): string {
	return typeof m === 'string' ? m : m.src
}

export type ScrapStickerKind = 'tall' | 'square' | 'wide'

export type ScrapSticker = {
	id: string
	src: string
	kind: ScrapStickerKind
}

/** @deprecated 用 SCRAP_STICKER_CATALOG */
export type PortalStickerKind = ScrapStickerKind
/** @deprecated */
export type PortalSticker = ScrapSticker

export const SCRAP_STICKER_CATALOG: ScrapSticker[] = [
	{ id: 'ionic-column', src: srcOf(ionicColumn), kind: 'tall' },
	{ id: 'gothic-arch', src: srcOf(gothicArch), kind: 'tall' },
	{ id: 'lantern', src: srcOf(lantern), kind: 'tall' },
	{ id: 'floral-secession', src: srcOf(floralSecession), kind: 'wide' },
	{ id: 'floral-1913', src: srcOf(floral1913), kind: 'square' },
	{ id: 'floral-lilien', src: srcOf(floralLilien), kind: 'wide' },
	{ id: 'floral-round', src: srcOf(floralRound), kind: 'square' },
	{ id: 'wax-seal', src: srcOf(waxSeal), kind: 'square' },
	{ id: 'scissors', src: srcOf(scissors), kind: 'wide' },
	{ id: 'compass-rose', src: srcOf(compassRose), kind: 'square' },
	{ id: 'fleur-de-lis', src: srcOf(fleurDeLis), kind: 'tall' },
	{ id: 'flower-psf', src: srcOf(flowerPsf), kind: 'square' },
	{ id: 'antique-key', src: srcOf(antiqueKey), kind: 'tall' },
	{ id: 'greek-temple', src: srcOf(greekTemple), kind: 'wide' },
	{ id: 'doric-temple', src: srcOf(doricTemple), kind: 'wide' },
	{ id: 'ionic-column-2', src: srcOf(ionicColumn2), kind: 'tall' },
	{ id: 'zakhrafa-greek', src: srcOf(zakhrafaGreek), kind: 'wide' },
	{ id: 'flower-ornament-black', src: srcOf(flowerOrnamentBlack), kind: 'square' },
	{ id: 'caryatid-scroll', src: srcOf(caryatidScroll), kind: 'tall' },
	{ id: 'grotesque-left', src: srcOf(grotesqueLeft), kind: 'tall' },
	{ id: 'grotesque-right', src: srcOf(grotesqueRight), kind: 'tall' },
	{ id: 'laurel-wreath', src: srcOf(laurelWreath), kind: 'square' },
	{ id: 'abbey', src: srcOf(abbey), kind: 'wide' },
	{ id: 'everybody-floral', src: srcOf(everybodyFloral), kind: 'square' },
	{ id: 'abstract-floral', src: srcOf(abstractFloral), kind: 'square' },
	{ id: 'abstract-floral-1913', src: srcOf(abstractFloral1913), kind: 'square' },
	{ id: 'lilien-floral', src: srcOf(lilienFloral), kind: 'wide' },
	{ id: 'retro-flower', src: srcOf(retroFlower), kind: 'wide' },
	{ id: 'quill', src: srcOf(quill), kind: 'tall' },
	{ id: 'amphora', src: srcOf(amphora), kind: 'tall' },
	{ id: 'lyre', src: srcOf(lyre), kind: 'tall' },
	{ id: 'caduceus', src: srcOf(caduceus), kind: 'tall' },
	{ id: 'ankh', src: srcOf(ankh), kind: 'tall' },
	{ id: 'olive-branch', src: srcOf(oliveBranch), kind: 'wide' },
	{ id: 'paper-scroll', src: srcOf(paperScroll), kind: 'wide' },
	{ id: 'candle', src: srcOf(candle), kind: 'tall' },
	{ id: 'butterfly-black', src: srcOf(butterflyBlack), kind: 'wide' },
	{ id: 'papillon', src: srcOf(papillon), kind: 'wide' },
	{ id: 'serrated-leaf', src: srcOf(serratedLeaf), kind: 'tall' },
	{ id: 'cattail', src: srcOf(cattail), kind: 'tall' },
	{ id: 'astrolabe-psf', src: srcOf(astrolabePsf), kind: 'square' },
	{ id: 'corinthian-helmet', src: srcOf(corinthianHelmet), kind: 'square' },
	{ id: 'castor-bean', src: srcOf(castorBean), kind: 'tall' },
]

/** @deprecated */
export const PORTAL_STICKER_CATALOG = SCRAP_STICKER_CATALOG
