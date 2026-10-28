/**
 * 剪贴簿风格对话气泡。
 * - user：粉色纸片气泡（右对齐，角上小菱形）
 * - bot：奶油色纸片气泡（左对齐）
 * 当前站点暂无聊天页，首页用它回显输入；后续聊天类页面可直接复用。
 */
import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

const bubbleVariants = cva(
	'rv-surface relative max-w-[85%] px-4 py-2.5 text-sm leading-relaxed shadow-surface',
	{
		variants: {
			from: {
				user: 'ml-auto rounded-[1.25rem_1.25rem_0.35rem_1.25rem] border border-[color:var(--rv-rose)] bg-[var(--rv-pink)] text-foreground',
				bot: 'mr-auto rounded-[1.25rem_1.25rem_1.25rem_0.35rem] border border-border/70 bg-card text-foreground',
			},
		},
		defaultVariants: { from: 'bot' },
	},
)

export interface ChatBubbleProps
	extends HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof bubbleVariants> {}

export function ChatBubble({ className, from, children, ...props }: ChatBubbleProps) {
	return (
		<div className={cn(bubbleVariants({ from }), className)} {...props}>
			{from === 'user' && (
				<span
					aria-hidden
					className="absolute -right-2 -top-2 h-3 w-3 rotate-45 border border-[color:var(--rv-navy)]/40 bg-[var(--rv-pink)]"
				/>
			)}
			{children}
		</div>
	)
}
