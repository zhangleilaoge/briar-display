import { assetUrl } from '@/lib/assets'

function createDecorAssets(paths: string[]) {
	return paths.map((path) => ({
		name: path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, ''),
		path,
		src: assetUrl(`decor/${path}`),
	}))
}

export const SCRAPBOOK_DECOR = createDecorAssets(
	[
		'01-00-iris',
		'01-01-maple-leaf',
		'01-02-wax-seal',
		'01-03-twine',
		'01-04-pencil',
		'01-05-postcard',
		'01-06-paper-plane',
		'01-07-postage-stamp',
		'01-08-binder-clip',
		'01-09-leaf-bookmark',
		'01-10-journal',
		'01-11-lace-doily',
		'01-12-quill',
		'01-13-inkwell',
		'01-14-brass-key',
		'01-15-pocket-watch',
		'01-16-lavender',
		'01-17-ticket',
		'01-18-bow',
		'01-19-envelope',
	].map((name) => `stationery-stickers/${name}.png`),
)

export const ARCANE_DECOR = createDecorAssets(
	[
		'02-00-roman-column',
		'02-01-greek-temple',
		'02-02-venus-statue',
		'02-03-stone-arch',
		'02-04-church-window',
		'02-05-porcelain-teapot',
		'02-06-porcelain-vase',
		'02-07-blue-pocket-watch',
		'02-08-teacup',
		'02-09-porcelain-plate',
		'02-10-arc-de-triomphe',
		'02-11-obelisk',
		'02-12-fountain',
		'02-13-stone-bridge',
		'02-14-classical-urn',
		'02-15-ginger-jar',
		'02-16-candelabrum',
		'02-17-porcelain-bowl',
		'02-18-mantel-clock',
		'02-19-chandelier',
	].map((name) => `stationery-stickers/${name}.png`),
)

export const RIBBON_DECOR = createDecorAssets(
	[
		'accueil-house',
		'clef-key',
		'etoiles-estoile',
		'fichiers-purse',
		'moi-cameo',
		'outils-inkwell-quill',
		'pensees-book',
	].map((name) => `ribbon-stickers/${name}.png`),
)

export const LINE_ART_DECOR = createDecorAssets([
	'floral-1913.svg',
	'gothic-arch.svg',
	'ionic-column.svg',
])

export const DECOR_GROUPS = [
	{ title: '手账剪纸', caption: 'Scrapbook', assets: SCRAPBOOK_DECOR },
	{ title: '蓝白古典贴纸', caption: 'Arcane', assets: ARCANE_DECOR },
	{ title: '吊牌插画', caption: 'Ribbon', assets: RIBBON_DECOR },
	{ title: '平面线稿', caption: 'Line art', assets: LINE_ART_DECOR },
]

export const SCRAPBOOK_STICKERS = SCRAPBOOK_DECOR.map(({ src }) => src)
export const ARCANE_STICKERS = ARCANE_DECOR.map(({ src }) => src)
