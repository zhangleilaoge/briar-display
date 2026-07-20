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
import { Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { FlatJsonEntry } from './toolJsonUtils'

interface JsonSearchDropdownProps {
	flatEntries: FlatJsonEntry[]
	onSelect: (entry: FlatJsonEntry) => void
}

export default function JsonSearchDropdown({ flatEntries, onSelect }: JsonSearchDropdownProps) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')

	const filteredEntries = useMemo(() => {
		if (!query.trim()) return flatEntries.slice(0, 20)
		const q = query.toLowerCase()
		return flatEntries
			.filter((e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q))
			.slice(0, 20)
	}, [flatEntries, query])

	const handleSelect = useCallback(
		(entry: FlatJsonEntry) => {
			setOpen(false)
			setQuery('')
			onSelect(entry)
		},
		[onSelect],
	)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" className="h-auto gap-1 px-2 py-1 text-xs">
					<Search className="h-3 w-3" />
					搜索
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="end">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="搜索 key / value…"
						value={query}
						onValueChange={setQuery}
						className="h-9 text-xs"
					/>
					<CommandList>
						<CommandEmpty>无匹配结果</CommandEmpty>
						<CommandGroup>
							{filteredEntries.map((entry, i) => (
								<CommandItem
									key={`${entry.path}-${i}`}
									value={`${entry.key}:${entry.value}:${entry.path}`}
									onSelect={() => handleSelect(entry)}
									className="flex flex-col items-start gap-0.5 py-1.5"
								>
									<span className="truncate font-mono text-[11px]">
										{entry.key}
										<span className="text-muted-foreground">: </span>
										<span className="text-blue-600">{entry.value}</span>
									</span>
									<span className="truncate text-[10px] text-muted-foreground">{entry.path}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
