// public 静态资源的 CDN 前缀解析：CI 构建注入 CDN 地址，本地构建回退源站路径
declare const __BRIAR_ASSETS_PREFIX__: string | undefined

const PREFIX = typeof __BRIAR_ASSETS_PREFIX__ === 'string' ? __BRIAR_ASSETS_PREFIX__ : ''

export const tftAsset = (p: string): string => (PREFIX ? `${PREFIX}${p}` : p)
