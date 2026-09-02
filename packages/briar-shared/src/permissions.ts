/**
 * RBAC 权限系统 - 共享类型和常量
 */

// ==================== 权限编码常量 ====================

/** 权限编码枚举 */
export const PERMISSIONS = {
	// 页面访问权限
	PAGE_ADMIN: 'page:admin',
	PAGE_BUSINESS: 'page:business',
	PAGE_SQL_CONSOLE: 'page:sql-console',

	// 管理后台
	ADMIN_ROLE_MANAGE: 'admin:role:manage',
	ADMIN_PERMISSION_MANAGE: 'admin:permission:manage',
	ADMIN_USER_MANAGE: 'admin:user:manage',
	ADMIN_USER_ROLE_ASSIGN: 'admin:user-role:assign',
	ADMIN_SQL_EXECUTE: 'admin:sql:execute',
	ADMIN_DEPLOY_MANAGE: 'admin:deploy:manage',
	ADMIN_TERMINAL_ACCESS: 'admin:terminal:access',
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
export type PermissionModule = 'admin' | 'system'

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
			{ code: PERMISSIONS.PAGE_ADMIN, name: '访问管理后台', type: 'page' },
			{ code: PERMISSIONS.PAGE_BUSINESS, name: '访问业务页面', type: 'page' },
			{ code: PERMISSIONS.PAGE_SQL_CONSOLE, name: '访问 SQL 控制台', type: 'page' },
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
			{ code: PERMISSIONS.ADMIN_SQL_EXECUTE, name: '执行 SQL', type: 'api' },
			{ code: PERMISSIONS.ADMIN_DEPLOY_MANAGE, name: '应用部署与证书', type: 'api' },
			{ code: PERMISSIONS.ADMIN_TERMINAL_ACCESS, name: 'SSH 控制台', type: 'api' },
		],
	},
]
