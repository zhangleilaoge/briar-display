import { assetUrl } from '@/lib/assets'

export const SCRAPBOOK_STICKERS = [
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
].map((name) => assetUrl(`decor/stationery-stickers/${name}.png`))
