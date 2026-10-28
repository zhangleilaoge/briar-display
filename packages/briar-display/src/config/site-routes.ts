/**
 * 站点子路由唯一数据源（纯数据，无 React/懒加载依赖）。
 * - 工具箱/管理后台的 SPA 路由表（TOOL_ROUTES / ADMIN_ROUTES）与顶栏 tab（*_NAV_ITEMS）由此派生；
 * - 首页搜索的「子路由」结果也由此派生，新增子页只需改这里。
 */
import { MARKET_IDS, MARKET_LABELS } from '@briar/shared'

export interface SubRouteMeta {
	path: string
	/** 中文名（tab 文案） */
	label: string
	/** 英/法文别名 */
	alias?: string
	/** 拼音首字母，便于 `jsgsh` 之类的速记搜索 */
	py?: string
	/** 额外关键词（用途、同义词） */
	keywords?: string
}

export interface SectionMeta {
	key: 'tools' | 'admin' | 'markets'
	/** 父级名称（面包屑） */
	title: string
	href: string
	adminOnly?: boolean
	children: SubRouteMeta[]
}

export const TOOLS_SECTION: SectionMeta = {
	key: 'tools',
	title: '工具箱',
	href: '/briar/tools',
	children: [
		{
			path: '/briar/tools/diff',
			label: '文件 Diff',
			alias: 'Diff Compare',
			py: 'wjdiff',
			keywords: '对比 比较 差异 文本',
		},
		{
			path: '/briar/tools/compress',
			label: '图片压缩',
			alias: 'Image Compress',
			py: 'tpys',
			keywords: '压图 png jpg webp 体积',
		},
		{
			path: '/briar/tools/json',
			label: 'JSON 格式化',
			alias: 'JSON Formatter',
			py: 'jsongsh',
			keywords: '美化 校验 压缩 格式',
		},
		{
			path: '/briar/tools/media',
			label: '媒体解析',
			alias: 'Media Parser',
			py: 'mtjx',
			keywords: '视频 图片 下载 抖音 小红书 去水印',
		},
		{
			path: '/briar/tools/magnet',
			label: '磁力查询',
			alias: 'Magnet',
			py: 'clcx',
			keywords: '种子 bt torrent 链接',
		},
		{
			path: '/briar/tools/regex',
			label: '正则可视化',
			alias: 'Regex Visualizer',
			py: 'zzksh',
			keywords: '正则表达式 regexp 匹配 测试',
		},
		{
			path: '/briar/tools/pdf',
			label: 'PDF 解除限制',
			alias: 'PDF Unlock',
			py: 'pdfjcxz',
			keywords: '解密 密码 去除 权限',
		},
		{
			path: '/briar/tools/section',
			label: '切面模拟器',
			alias: 'Section Simulator',
			py: 'qmmnq',
			keywords: '三维 3d 截面 剖面',
		},
	],
}

export const ADMIN_SECTION: SectionMeta = {
	key: 'admin',
	title: '管理后台',
	href: '/briar/admin',
	adminOnly: true,
	children: [
		{
			path: '/briar/admin/permissions',
			label: '权限管理',
			alias: 'Permissions',
			py: 'qxgl',
			keywords: '角色 权限点 rbac',
		},
		{
			path: '/briar/admin/users',
			label: '用户角色',
			alias: 'Users',
			py: 'yhjs',
			keywords: '用户 分配 账号',
		},
		{
			path: '/briar/admin/logs',
			label: '天网日志',
			alias: 'Request Logs',
			py: 'twrz',
			keywords: '日志 请求 trace 审计 监控',
		},
		{
			path: '/briar/admin/sql',
			label: 'SQL 控制台',
			alias: 'SQL Console',
			py: 'sqlkzt',
			keywords: '数据库 查询 database',
		},
		{
			path: '/briar/admin/deploy',
			label: '应用部署',
			alias: 'Deploy',
			py: 'yybs',
			keywords: '发布 部署日志 github actions nginx 证书 定时任务',
		},
		{
			path: '/briar/admin/terminal',
			label: 'SSH 控制台',
			alias: 'SSH Terminal',
			py: 'sshkzt',
			keywords: '终端 服务器 shell 命令行',
		},
	],
}

const MARKET_ALIAS: Record<string, [string, string]> = {
	cn: ['China A-shares', 'ag'],
	hk: ['Hong Kong', 'gg'],
	us: ['US Stocks', 'mg'],
	jp: ['Japan', 'rb'],
	kr: ['Korea', 'hg'],
}

export const MARKETS_SECTION: SectionMeta = {
	key: 'markets',
	title: '全球板块',
	href: '/briar/markets',
	children: MARKET_IDS.map((id) => ({
		path: `/briar/markets/${id}`,
		label: `${MARKET_LABELS[id]}板块`,
		alias: MARKET_ALIAS[id]?.[0],
		py: `${MARKET_ALIAS[id]?.[1] ?? ''}bk`,
		keywords: `行情 股票 ${id}`,
	})),
}

export const SITE_SECTIONS: SectionMeta[] = [TOOLS_SECTION, ADMIN_SECTION, MARKETS_SECTION]

/** SPA 文档标题：「子页 - 分区」 */
export const sectionTitle = (section: SectionMeta, sub: SubRouteMeta) =>
	`${sub.label} - ${section.title}`
