'use client'

import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { WikiTag } from '@briar/shared'
import { Check, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface TagInputProps {
	value: string[]
	onChange: (tags: string[]) => void
	placeholder?: string
}

export default function TagInput({
	value,
	onChange,
	placeholder = '搜索或输入标签…',
}: TagInputProps) {
	const [open, setOpen] = useState(false)
	const [allTags, setAllTags] = useState<WikiTag[]>([])
	const [inputValue, setInputValue] = useState('')

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
		<div className="space-y-2">
			{/* Selected tags */}
			{value.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{value.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary text-xs"
						>
							{tag}
							<button
								type="button"
								onClick={() => removeTag(tag)}
								className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
							>
								<X className="h-3 w-3" />
							</button>
						</span>
					))}
				</div>
			)}

			{/* Tag selector popover */}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						// biome-ignore lint/a11y/useSemanticElements: shadcn combobox pattern
						role="combobox"
						aria-expanded={open}
						className="w-full justify-start font-normal text-muted-foreground"
					>
						{placeholder}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
					<Command>
						<CommandInput
							placeholder="搜索标签…"
							value={inputValue}
							onValueChange={setInputValue}
							onKeyDown={handleKeyDown}
						/>
						<CommandList>
							<CommandEmpty>
								{inputValue.trim() ? '输入名称后按回车创建新标签' : '暂无标签'}
							</CommandEmpty>
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
												className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${isSelected ? '' : 'opacity-60'}`}
												style={{ backgroundColor: tag.color }}
											/>
											{tag.name}
											{tag.pageCount > 0 && (
												<span className="ml-auto text-muted-foreground text-xs">
													{tag.pageCount}
												</span>
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
		</div>
	)
}
