import mapping from './fileIconMapping.json'

const ICON_BASE_PATH = '/briar/file-icons'

interface FileIconMapping {
	defaultIcon: string
	extensions: Record<string, string>
	fileNames: Record<string, string>
}

const iconMapping = mapping as FileIconMapping
const lowerCaseExtensions: Record<string, string> = {}
for (const [extension, icon] of Object.entries(iconMapping.extensions)) {
	const key = extension.toLowerCase()
	if (!(key in lowerCaseExtensions)) lowerCaseExtensions[key] = icon
}

function getMimeIcon(mimeType: string): string | null {
	const mime = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
	if (mime === 'application/pdf') return 'pdf.svg'
	if (mime.includes('word')) return 'word.svg'
	if (mime.includes('excel') || mime.includes('spreadsheet')) return 'table.svg'
	if (mime.includes('powerpoint') || mime.includes('presentation')) return 'powerpoint.svg'
	if (mime.includes('zip') || mime.includes('x-7z') || mime.includes('x-rar')) return 'zip.svg'
	if (mime === 'application/json' || mime.endsWith('+json')) return 'json.svg'
	if (mime.startsWith('audio/')) return 'audio.svg'
	if (mime.startsWith('video/')) return 'video.svg'
	if (mime.startsWith('image/')) return 'image.svg'
	if (mime.startsWith('text/')) return 'document.svg'
	return null
}

export function getFileTypeIconPath(fileName: string, mimeType = ''): string {
	const normalizedName = fileName.replaceAll('\\', '/').replace(/^\.\//, '')
	const baseName = normalizedName.split('/').pop() ?? normalizedName
	const exactNameIcon = iconMapping.fileNames[normalizedName] ?? iconMapping.fileNames[baseName]
	if (exactNameIcon) return `${ICON_BASE_PATH}/${exactNameIcon}`

	for (let index = 0; index < baseName.length - 1; index++) {
		if (baseName[index] !== '.') continue
		for (const candidate of [baseName.slice(index), baseName.slice(index + 1)]) {
			const icon = iconMapping.extensions[candidate] ?? lowerCaseExtensions[candidate.toLowerCase()]
			if (icon) return `${ICON_BASE_PATH}/${icon}`
		}
	}

	return `${ICON_BASE_PATH}/${getMimeIcon(mimeType) ?? iconMapping.defaultIcon}`
}
