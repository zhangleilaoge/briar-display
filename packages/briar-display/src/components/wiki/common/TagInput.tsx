'use client'

import { wikiApi } from '@/api/wiki'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { WikiTag } from '@briar/shared'
import { Check, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface TagInputProps {
	value: string[]
	onChange: (tags: string[]) => void
	placeholder?: string
}

export default function TagInput({ value, onChange, placeholder = '添加标签…' }: TagInputProps) {
	const [open, setOpen] = useState(false)
	const [allTags, setAllTags] = useState<WikiTag[]>([])
	const [inputValue, setInputValue] = useState('')
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		wikiApi.getTags().then((res) => {
			if (res.success && res.data) {
				setAllTags(res.data)
			}
		})
	}, [])

	const toggleTag = useCallback(
		(tagName: string) => {
			if (value.includes(tagName)) {
				onChange(value.filter((t) => t !== tagName))
			} else {
				onChange([...value, tagName])
			}
		},
		[value, onChange],
	)

	const removeTag = useCallback(
		(tag: string) => {
			onChange(value.filter((t) => t !== tag))
		},
		[value, onChange],
	)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' && inputValue.trim() && !value.includes(inputValue.trim())) {
				e.preventDefault()
				onChange([...value, inputValue.trim()])
				setInputValue('')
			}
			if (e.key === 'Backspace' && !inputValue && value.length > 0) {
				onChange(value.slice(0, -1))
			}
		},
		[inputValue, value, onChange],
	)

	const filteredTags = allTags.filter(
		(t) => !inputValue || t.name.toLowerCase().includes(inputValue.toLowerCase()),
	)

	const showCreateOption =
		inputValue.trim() &&
		!allTags.some((t) => t.name.toLowerCase() === inputValue.trim().toLowerCase()) &&
		!value.includes(inputValue.trim())

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<div
					ref={containerRef}
					className={cn(
						'flex min-h-[32px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-sm border border-wiki-border bg-wiki-bg px-2.5 py-1 text-[13px] text-wiki-text transition-colors',
						'focus-within:border-wiki-link',
						open && 'border-wiki-link',
					)}
					onClick={() => setOpen(true)}
				>
					{value.map((tag) => {
						const tagData = allTags.find((t) => t.name === tag)
						return (
							<span
								key={tag}
								className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground text-xs"
							>
								{tagData && (
									<span
										className="inline-block h-2 w-2 rounded-full"
										style={{ backgroundColor: tagData.color }}
									/>
								)}
								{tag}
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation()
										removeTag(tag)
									}}
									className="rounded-sm p-0.5 transition-colors hover:bg-secondary/80"
								>
									<X className="h-3 w-3" />
								</button>
							</span>
						)
					})}
					<span className="min-w-[60px] flex-1 text-muted-foreground">
						{value.length === 0 && placeholder}
					</span>
				</div>
			</PopoverTrigger>
			<PopoverContent
				className="w-[--radix-popover-trigger-width] p-0"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<Command>
					<CommandInput
						placeholder="搜索或新建标签…"
						value={inputValue}
						onValueChange={setInputValue}
						onKeyDown={handleKeyDown}
						autoFocus
					/>
					<CommandList>
						<CommandEmpty>{inputValue.trim() ? '按回车创建新标签' : '暂无标签'}</CommandEmpty>
						<CommandGroup>
							{showCreateOption && (
								<CommandItem
									value={`__create_${inputValue}`}
									onSelect={() => {
										onChange([...value, inputValue.trim()])
										setInputValue('')
										setOpen(false)
									}}
								>
									创建标签「{inputValue.trim()}」
								</CommandItem>
							)}
							{filteredTags.map((tag) => {
								const isSelected = value.includes(tag.name)
								return (
									<CommandItem key={tag.id} value={tag.name} onSelect={() => toggleTag(tag.name)}>
										<span
											className={cn(
												'mr-2 inline-block h-2.5 w-2.5 rounded-full',
												isSelected ? '' : 'opacity-60',
											)}
											style={{ backgroundColor: tag.color }}
										/>
										{tag.name}
										{tag.pageCount > 0 && (
											<span className="ml-auto text-muted-foreground text-xs">{tag.pageCount}</span>
										)}
										{isSelected && <Check className="ml-1 h-4 w-4 text-primary" />}
									</CommandItem>
								)
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
