'use client'

import { useEffect } from 'react'

/**
 * @deprecated 上传功能已整合到相册页，此页面重定向到 /gallery
 */
export default function ImageUploadPage() {
	useEffect(() => {
		window.location.href = '/briar-display/images/gallery'
	}, [])
	return null
}
