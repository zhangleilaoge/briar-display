'use client'

/**
 * 想法「记一笔 / 编辑」旁的 emoji 选择器（native 字形，插入到当前文本末尾）。
 */
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { EmojiClickData } from 'emoji-picker-react'
import { SmilePlus } from 'lucide-react'
import { Suspense, lazy, useState } from 'react'

const EmojiPicker = lazy(() => import('emoji-picker-react'))

type Props = {
	onPick: (emoji: string) => void
	disabled?: boolean
	/** 已用字数，接近上限时仍可开面板但插入会被调用方截断 */
	className?: string
}

export function EmojiInsertButton({ onPick, disabled, className }: Props) {
	const [open, setOpen] = useState(false)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled}
					className={className ?? 'h-8 gap-1 rounded-none px-2 text-xs'}
					aria-label="插入 emoji"
					title="插入 emoji"
				>
					<SmilePlus className="h-3.5 w-3.5" />
					emoji
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="top"
				className="w-auto border-border/60 p-0 shadow-lg"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<Suspense
					fallback={
						<div className="flex h-[350px] w-[320px] items-center justify-center text-xs text-muted-foreground">
							加载中…
						</div>
					}
				>
					<EmojiPicker
						onEmojiClick={(data: EmojiClickData) => {
							onPick(data.emoji)
							setOpen(false)
						}}
						theme={'light' as const}
						emojiStyle={'native' as const}
						lazyLoadEmojis
						searchPlaceHolder="搜索 emoji"
						width={320}
						height={360}
						previewConfig={{ showPreview: false }}
					/>
				</Suspense>
			</PopoverContent>
		</Popover>
	)
}
