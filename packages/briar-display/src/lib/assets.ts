const STATIC_ASSET_BASE =
	'https://briar-shanghai-1309736035.cos.ap-shanghai.myqcloud.com/static/assets'

export const assetUrl = (path: string) => `${STATIC_ASSET_BASE}/${path.replace(/^\/+/, '')}`
