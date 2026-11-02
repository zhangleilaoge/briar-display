import type { RibbonTagKind } from './ribbon-tags'

export interface RibbonItem {
	href: string
	match: string
	label: string
	caption: string
	kind: RibbonTagKind
	adminOnly?: boolean
}

export const RIBBON_ITEMS: RibbonItem[] = [
	{ href: '/briar/', match: '/briar', label: '首页', caption: 'Accueil', kind: 'home' },
	{
		href: '/briar/style',
		match: '/briar/style',
		label: '风格',
		caption: 'Style',
		kind: 'style',
	},
	{
		href: '/briar/tools',
		match: '/briar/tools',
		label: '工具箱',
		caption: 'Outils',
		kind: 'tools',
	},
	{
		href: '/briar/files',
		match: '/briar/files',
		label: '文件',
		caption: 'Fichiers',
		kind: 'files',
	},
	{
		href: '/briar/thoughts/',
		match: '/briar/thoughts',
		label: '想法',
		caption: 'Pensées',
		kind: 'thoughts',
	},
	{
		href: '/briar/markets',
		match: '/briar/markets',
		label: '行情',
		caption: 'Étoiles',
		kind: 'markets',
	},
	{
		href: '/briar/admin',
		match: '/briar/admin',
		label: '管理',
		caption: 'Clef',
		kind: 'admin',
		adminOnly: true,
	},
	{
		href: '/briar/profile',
		match: '/briar/profile',
		label: '个人',
		caption: 'Moi',
		kind: 'profile',
	},
]

export const DEFAULT_RIBBON_ORDER = RIBBON_ITEMS.map((item) => item.kind)
