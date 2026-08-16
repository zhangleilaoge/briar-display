import {
	FaFile,
	FaFileAlt,
	FaFileArchive,
	FaFileAudio,
	FaFileCode,
	FaFileCsv,
	FaFileExcel,
	FaFilePdf,
	FaFilePowerpoint,
	FaFileWord,
} from 'react-icons/fa'

const CODE_EXTENSIONS = new Set([
	'js',
	'jsx',
	'ts',
	'tsx',
	'html',
	'css',
	'vue',
	'py',
	'java',
	'c',
	'cpp',
	'go',
	'rs',
	'sh',
	'php',
	'rb',
	'swift',
	'kt',
	'sql',
	'yaml',
	'yml',
	'xml',
])

const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2'])

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'])

const getExtension = (name: string): string => {
	const idx = name.lastIndexOf('.')
	return idx > 0 ? name.slice(idx + 1).toLowerCase() : ''
}

const pickIcon = (fileName: string, mimeType: string) => {
	const ext = getExtension(fileName)
	if (mimeType === 'application/pdf' || ext === 'pdf') {
		return { Icon: FaFilePdf, color: 'text-red-500' }
	}
	if (['doc', 'docx'].includes(ext)) return { Icon: FaFileWord, color: 'text-blue-500' }
	if (['xls', 'xlsx'].includes(ext)) return { Icon: FaFileExcel, color: 'text-green-600' }
	if (ext === 'csv') return { Icon: FaFileCsv, color: 'text-green-600' }
	if (['ppt', 'pptx'].includes(ext)) return { Icon: FaFilePowerpoint, color: 'text-orange-500' }
	if (ARCHIVE_EXTENSIONS.has(ext)) return { Icon: FaFileArchive, color: 'text-yellow-600' }
	if (mimeType.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) {
		return { Icon: FaFileAudio, color: 'text-purple-500' }
	}
	if (CODE_EXTENSIONS.has(ext)) return { Icon: FaFileCode, color: 'text-muted-foreground' }
	if (mimeType === 'application/json' || mimeType.startsWith('text/')) {
		return { Icon: FaFileAlt, color: 'text-muted-foreground' }
	}
	return { Icon: FaFile, color: 'text-muted-foreground' }
}

interface FileTypeIconProps {
	fileName: string
	mimeType: string
	className?: string
}

/** 不可预览文件的默认图标：文件轮廓中间带类型标识（Font Awesome 文件系列） */
const FileTypeIcon = ({ fileName, mimeType, className = 'h-12 w-12' }: FileTypeIconProps) => {
	const { Icon, color } = pickIcon(fileName, mimeType)
	return <Icon className={`${className} ${color}`} aria-hidden />
}

export default FileTypeIcon
