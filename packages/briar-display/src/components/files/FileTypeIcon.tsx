import { cn } from '@/lib/utils'
import { getFileTypeIconPath } from './fileTypeIconPath'

interface FileTypeIconProps {
	fileName: string
	mimeType: string
	className?: string
}

const FileTypeIcon = ({ fileName, mimeType, className = 'h-12 w-12' }: FileTypeIconProps) => {
	return (
		<img
			src={getFileTypeIconPath(fileName, mimeType)}
			alt=""
			aria-hidden
			draggable={false}
			loading="lazy"
			className={cn(className, 'shrink-0 select-none')}
		/>
	)
}

export default FileTypeIcon
