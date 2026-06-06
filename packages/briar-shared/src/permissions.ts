/**
 * RBAC 权限系统 - 共享类型和常量
 */

// ==================== 权限编码常量 ====================

/** 权限编码枚举 */
export const PERMISSIONS = {
	// 页面访问权限
	PAGE_WIKI: 'page:wiki',
	PAGE_ADMIN: 'page:admin',
	PAGE_BUSINESS: 'page:business',

	// Wiki - 页面操作
	WIKI_PAGE_CREATE: 'wiki:page:create',
	WIKI_PAGE_UPDATE: 'wiki:page:update',
	WIKI_PAGE_DELETE: 'wiki:page:delete',
	WIKI_PAGE_PROTECT: 'wiki:page:protect',

	// Wiki - 版本
	WIKI_REVISION_REVERT: 'wiki:revision:revert',

	// Wiki - 分类
	WIKI_CATEGORY_CREATE: 'wiki:category:create',
	WIKI_CATEGORY_UPDATE: 'wiki:category:update',
	WIKI_CATEGORY_DELETE: 'wiki:category:delete',

	// Wiki - 标签
	WIKI_TAG_CREATE: 'wiki:tag:create',
	WIKI_TAG_DELETE: 'wiki:tag:delete',

	// Wiki - 模板
	WIKI_TEMPLATE_CREATE: 'wiki:template:create',
	WIKI_TEMPLATE_UPDATE: 'wiki:template:update',
	WIKI_TEMPLATE_DELETE: 'wiki:template:delete',

	// Wiki - 讨论
	WIKI_DISCUSSION_CREATE: 'wiki:discussion:create',
	WIKI_DISCUSSION_REPLY: 'wiki:discussion:reply',
	WIKI_DISCUSSION_RESOLVE: 'wiki:discussion:resolve',

	// Wiki - 评论
	WIKI_COMMENT_CREATE: 'wiki:comment:create',
	WIKI_COMMENT_UPDATE: 'wiki:comment:update',
	WIKI_COMMENT_DELETE: 'wiki:comment:delete',

	// Wiki - 变更请求
	WIKI_CHANGE_REQUEST_CREATE: 'wiki:change-request:create',
	WIKI_CHANGE_REQUEST_REVIEW: 'wiki:change-request:review',

	// Wiki - 个人功能
	WIKI_WATCHLIST_MANAGE: 'wiki:watchlist:manage',
	WIKI_STAR_MANAGE: 'wiki:star:manage',

	// 管理后台
	ADMIN_ROLE_MANAGE: 'admin:role:manage',
	ADMIN_PERMISSION_MANAGE: 'admin:permission:manage',
	ADMIN_USER_MANAGE: 'admin:user:manage',
	ADMIN_USER_ROLE_ASSIGN: 'admin:user-role:assign',
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ==================== 默认角色名 ====================

export const SYSTEM_ROLES = {
	USER: 'user',
	MODERATOR: 'moderator',
	ADMIN: 'admin',
} as const

// ==================== 权限类型 ====================

/** 权限类型 */
export type PermissionType = 'page' | 'api'

/** 权限模块 */
export type PermissionModule = 'wiki' | 'admin' | 'system'

// ==================== 权限分组（用于前端展示） ====================

export interface PermissionGroup {
	module: string
	label: string
	permissions: {
		code: string
		name: string
		type: PermissionType
	}[]
}

/** 权限分组配置 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
	{
		module: 'page',
		label: '页面访问',
		permissions: [
			{ code: PERMISSIONS.PAGE_WIKI, name: '访问 Wiki', type: 'page' },
			{ code: PERMISSIONS.PAGE_ADMIN, name: '访问管理后台', type: 'page' },
			{ code: PERMISSIONS.PAGE_BUSINESS, name: '访问业务页面', type: 'page' },
		],
	},
	{
		module: 'wiki:page',
		label: 'Wiki 页面操作',
		permissions: [
			{ code: PERMISSIONS.WIKI_PAGE_CREATE, name: '创建页面', type: 'api' },
			{ code: PERMISSIONS.WIKI_PAGE_UPDATE, name: '编辑页面', type: 'api' },
			{ code: PERMISSIONS.WIKI_PAGE_DELETE, name: '删除页面', type: 'api' },
			{ code: PERMISSIONS.WIKI_PAGE_PROTECT, name: '保护页面', type: 'api' },
			{ code: PERMISSIONS.WIKI_REVISION_REVERT, name: '回退版本', type: 'api' },
		],
	},
	{
		module: 'wiki:category',
		label: 'Wiki 分类管理',
		permissions: [
			{ code: PERMISSIONS.WIKI_CATEGORY_CREATE, name: '创建分类', type: 'api' },
			{ code: PERMISSIONS.WIKI_CATEGORY_UPDATE, name: '编辑分类', type: 'api' },
			{ code: PERMISSIONS.WIKI_CATEGORY_DELETE, name: '删除分类', type: 'api' },
		],
	},
	{
		module: 'wiki:tag',
		label: 'Wiki 标签管理',
		permissions: [
			{ code: PERMISSIONS.WIKI_TAG_CREATE, name: '创建标签', type: 'api' },
			{ code: PERMISSIONS.WIKI_TAG_DELETE, name: '删除标签', type: 'api' },
		],
	},
	{
		module: 'wiki:template',
		label: 'Wiki 模板管理',
		permissions: [
			{ code: PERMISSIONS.WIKI_TEMPLATE_CREATE, name: '创建模板', type: 'api' },
			{ code: PERMISSIONS.WIKI_TEMPLATE_UPDATE, name: '编辑模板', type: 'api' },
			{ code: PERMISSIONS.WIKI_TEMPLATE_DELETE, name: '删除模板', type: 'api' },
		],
	},
	{
		module: 'wiki:discussion',
		label: 'Wiki 讨论与评论',
		permissions: [
			{ code: PERMISSIONS.WIKI_DISCUSSION_CREATE, name: '创建讨论', type: 'api' },
			{ code: PERMISSIONS.WIKI_DISCUSSION_REPLY, name: '回复讨论', type: 'api' },
			{ code: PERMISSIONS.WIKI_DISCUSSION_RESOLVE, name: '标记已解决', type: 'api' },
			{ code: PERMISSIONS.WIKI_COMMENT_CREATE, name: '创建评论', type: 'api' },
			{ code: PERMISSIONS.WIKI_COMMENT_UPDATE, name: '编辑评论', type: 'api' },
			{ code: PERMISSIONS.WIKI_COMMENT_DELETE, name: '删除评论', type: 'api' },
		],
	},
	{
		module: 'wiki:change-request',
		label: 'Wiki 变更请求',
		permissions: [
			{ code: PERMISSIONS.WIKI_CHANGE_REQUEST_CREATE, name: '创建变更请求', type: 'api' },
			{ code: PERMISSIONS.WIKI_CHANGE_REQUEST_REVIEW, name: '审核变更请求', type: 'api' },
		],
	},
	{
		module: 'wiki:personal',
		label: 'Wiki 个人功能',
		permissions: [
			{ code: PERMISSIONS.WIKI_WATCHLIST_MANAGE, name: '管理关注列表', type: 'api' },
			{ code: PERMISSIONS.WIKI_STAR_MANAGE, name: '管理收藏', type: 'api' },
		],
	},
	{
		module: 'admin',
		label: '管理后台',
		permissions: [
			{ code: PERMISSIONS.ADMIN_ROLE_MANAGE, name: '管理角色', type: 'api' },
			{ code: PERMISSIONS.ADMIN_PERMISSION_MANAGE, name: '管理权限', type: 'api' },
			{ code: PERMISSIONS.ADMIN_USER_MANAGE, name: '管理用户', type: 'api' },
			{ code: PERMISSIONS.ADMIN_USER_ROLE_ASSIGN, name: '分配用户角色', type: 'api' },
		],
	},
]
