/**
 * 双主题组件视觉清单（预设计骨架）
 *
 * 约定：
 * - 不 fork 两套 React 文件；视觉差用 CSS token / `.theme-scrapbook` | `.theme-arcane` 分流。
 * - Dialog / Popover / Select / Command / HoverCard 共用 `.rv-paper-*` 纸片体系（见 theme.css）。
 * - 本文件是「还要做双视觉」的清单与状态，供后续 PR 逐项落地；不要在这里写运行时分支逻辑。
 *
 * status:
 * - done：本 PR 或更早已有可用双视觉
 * - skeleton：仅 token / 注释 / 清单，视觉仍偏共用
 * - todo：尚未分主题
 */
import type { ReverieTheme } from './theme'

export type ThemeVariantStatus = 'done' | 'skeleton' | 'todo'

export type ThemeVariantComponent = {
	/** components/ui 名或纸片体系别名 */
	id: string
	/** 主要分流手段 */
	via: 'css-theme-class' | 'css-token' | 'shared-paper' | 'react-prop'
	status: ThemeVariantStatus
	notes?: string
}

/**
 * 需要（或已有）scrapbook | arcane 两套观感的基础组件。
 * 新增 ui 组件时先在此登记，再补 theme.css 分区注释。
 */
export const THEME_VARIANT_COMPONENTS: readonly ThemeVariantComponent[] = [
	{
		id: 'dialog',
		via: 'shared-paper',
		status: 'done',
		notes: 'scrapbook 纸片顶栏 + 折角纸签关闭 + 纸张收起；arcane 藏青顶栏 + HUD 裁切角 + CRT 关屏',
	},
	{
		id: 'popover',
		via: 'shared-paper',
		status: 'done',
		notes: '共用 .rv-paper-float；scrapbook 暖粉描边仍方角',
	},
	{
		id: 'select',
		via: 'shared-paper',
		status: 'done',
		notes: '下拉浮层方角约定保留；颜色跟剪纸/冰蓝分流',
	},
	{
		id: 'command',
		via: 'shared-paper',
		status: 'done',
		notes: '共用 .rv-paper-float 选中粉洗 / 冰蓝洗',
	},
	{
		id: 'hover-card',
		via: 'shared-paper',
		status: 'done',
		notes: '同 popover 纸片浮层',
	},
	{
		id: 'sonner',
		via: 'shared-paper',
		status: 'skeleton',
		notes: 'toast 已挂 rv-paper-float；细调跟弹窗即可',
	},
	{
		id: 'button',
		via: 'css-token',
		status: 'skeleton',
		notes: '已有 --btn-*-image；Arcane 淡蓝水彩已部分落地',
	},
	{
		id: 'tabs',
		via: 'css-token',
		status: 'skeleton',
		notes: '--tabs-list-bg / --tab-active-*：scrapbook 暖粉纸标签；天气另有 .rv-wx-tabs 索引签',
	},
	{
		id: 'weather-dialog',
		via: 'css-theme-class',
		status: 'done',
		notes: '.rv-wx-*：scrapbook 双层纸页/胶带主视觉/票据小时带/账目式七日；arcane 直角 HUD',
	},
	{
		id: 'badge',
		via: 'css-token',
		status: 'todo',
	},
	{
		id: 'input',
		via: 'css-token',
		status: 'done',
		notes:
			'scrapbook 纸片柔角 + 暖灰粉描边；天气搜索 .rv-wx-search；arcane 直角 --radius-field:2px',
	},
	{
		id: 'textarea',
		via: 'css-token',
		status: 'skeleton',
	},
	{
		id: 'card',
		via: 'css-token',
		status: 'skeleton',
		notes: 'surface / glass 已有 scrapbook|arcane 覆盖',
	},
	{
		id: 'table',
		via: 'css-token',
		status: 'todo',
	},
	{
		id: 'checkbox',
		via: 'css-token',
		status: 'todo',
	},
	{
		id: 'switch',
		via: 'css-token',
		status: 'todo',
	},
	{
		id: 'slider',
		via: 'css-token',
		status: 'todo',
	},
	{
		id: 'calendar',
		via: 'css-theme-class',
		status: 'todo',
	},
	{
		id: 'breadcrumb',
		via: 'css-token',
		status: 'todo',
	},
] as const

export function themeVariantIdsFor(status: ThemeVariantStatus): string[] {
	return THEME_VARIANT_COMPONENTS.filter((c) => c.status === status).map((c) => c.id)
}

/** 文档/注释用：两主题短标签 */
export function themeVariantLabel(theme: ReverieTheme): string {
	return theme === 'arcane' ? 'Arcane 1999 HUD' : '暖粉剪纸手账 Scrapbook'
}
