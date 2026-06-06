import { cn } from '@/lib/utils'

interface ToolbarButtonProps {
	icon: React.ElementType
	label: string
	isActive?: boolean
	disabled?: boolean
	onClick: () => void
}

export function ToolbarButton({
	icon: Icon,
	label,
	isActive = false,
	disabled = false,
	onClick,
}: ToolbarButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={label}
			className={cn(
				'inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors',
				isActive ? 'bg-wiki-link text-white' : 'text-wiki-text hover:bg-wiki-bg-tertiary',
				disabled && 'cursor-not-allowed opacity-50',
			)}
		>
			<Icon className="h-4 w-4" />
		</button>
	)
}

export function ToolbarSeparator() {
	return <div className="mx-1 h-6 w-px bg-wiki-border-light" />
}

/** 将 [[slug|display]] 语法转为 markdown 链接 */
export function renderMentions(content: string): string {
	return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, slug, display) => {
		const label = display || slug
		return `[${label}](/briar-display/wiki/${slug})`
	})
}
