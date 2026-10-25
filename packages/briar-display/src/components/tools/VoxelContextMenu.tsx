import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Palette, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import type { Vec3 } from './toolSectionUtils'

export type VoxelMenuPosition = {
	cell: Vec3
	clientX: number
	clientY: number
}

export function VoxelContextMenu({
	menu,
	isBlack,
	onClose,
	onRemove,
	onToggleColor,
}: {
	menu: VoxelMenuPosition
	isBlack: boolean
	onClose: () => void
	onRemove: (cell: Vec3) => void
	onToggleColor: (cell: Vec3) => void
}) {
	const commandRef = useRef<HTMLDivElement>(null)
	return (
		<Popover open onOpenChange={(open) => !open && onClose()}>
			<PopoverAnchor asChild>
				<span
					aria-hidden
					className="pointer-events-none fixed h-px w-px"
					style={{ left: menu.clientX, top: menu.clientY }}
				/>
			</PopoverAnchor>
			<PopoverContent
				align="start"
				side="right"
				sideOffset={0}
				collisionPadding={8}
				className="w-44 p-1"
				aria-label="方块操作"
				data-voxel-menu
				onOpenAutoFocus={(event) => {
					event.preventDefault()
					commandRef.current?.focus()
				}}
			>
				<Command ref={commandRef} tabIndex={-1}>
					<CommandList>
						<CommandGroup>
							<CommandItem
								value="删除方块"
								className="cursor-pointer text-destructive"
								onSelect={() => {
									onRemove(menu.cell)
									onClose()
								}}
							>
								<Trash2 />
								删除方块
							</CommandItem>
							<CommandItem
								value={isBlack ? '调整为白色' : '调整为黑色'}
								className="cursor-pointer"
								onSelect={() => {
									onToggleColor(menu.cell)
									onClose()
								}}
							>
								<Palette />
								{isBlack ? '调整为白色' : '调整为黑色'}
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
