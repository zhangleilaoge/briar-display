interface SpeakerBadgeProps {
	name: string
	color?: string
	onClick?: () => void
}

export function SpeakerBadge({ name, color, onClick }: SpeakerBadgeProps) {
	const style = color
		? { backgroundColor: `${color}20`, color, borderColor: `${color}40` }
		: undefined

	return (
		<button
			onClick={onClick}
			className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium transition hover:opacity-80"
			style={style}
		>
			{name}
		</button>
	)
}
