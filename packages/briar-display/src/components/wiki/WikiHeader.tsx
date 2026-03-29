'use client'

interface WikiHeaderProps {
	title: string
	description?: string
	showAction?: {
		label: string
		onClick: () => void
	}
}

export default function WikiHeader({ title, description, showAction }: WikiHeaderProps) {
	return (
		<div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-6">
			<div className="flex-1">
				<h1 className="text-4xl font-bold text-gray-900 mb-2">{title}</h1>
				{description && <p className="text-lg text-gray-600">{description}</p>}
			</div>
			{showAction && (
				<button
					onClick={showAction.onClick}
					className="ml-6 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 font-semibold whitespace-nowrap"
				>
					{showAction.label}
				</button>
			)}
		</div>
	)
}
