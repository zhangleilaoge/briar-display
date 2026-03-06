/**
 * 路由配置
 * 定义公共路径和需要认证的路径规则
 */

export const RouteConfig = {
  /** 完全公开的路径（前端页面） */
  PUBLIC_PATHS: new Set(["/briar-display/login", "/briar-display/register"]),

  /** 公开的路径前缀 */
  PUBLIC_PREFIXES: ["/demo"],

  /** API 不需要认证的路径 */
  API_PUBLIC_PATHS: [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/send-reset-code",
    "/api/auth/reset-password",
  ],

  /** API 不需要认证的路径前缀 */
  API_PUBLIC_PREFIXES: [],

  /** 资源文件前缀 */
  ASSET_PREFIXES: ["/_astro"],
} as const

/**
 * 判断是否为公开页面路径
 */
export const isPublicPath = (pathname: string): boolean => {
  if (RouteConfig.PUBLIC_PATHS.has(pathname)) {
    return true
  }

  return RouteConfig.PUBLIC_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  )
}

/**
 * 判断是否为静态资源路径
 */
export const isAssetPath = (pathname: string): boolean => {
  if (
    RouteConfig.ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return true
  }

  // 包含文件扩展名的视为资源文件
  return pathname.includes(".")
}

/**
 * 判断 API 路径是否需要认证
 */
export const isApiPublicPath = (pathname: string): boolean => {
  // 检查精确路径匹配
  const exactMatch = RouteConfig.API_PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )

  // 检查前缀匹配
  const prefixMatch = RouteConfig.API_PUBLIC_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  )

  return exactMatch || prefixMatch
}
