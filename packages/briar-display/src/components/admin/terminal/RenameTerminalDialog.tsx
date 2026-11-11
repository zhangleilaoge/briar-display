'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useEffect, useState } from 'react'
import { TERMINAL_TAB_NAME_MAX_LENGTH, normalizeTerminalTabName } from './terminalTabNames'

interface RenameTerminalDialogProps {
	session: { id: number; name: string } | null
	onOpenChange: (open: boolean) => void
	onRename: (id: number, name: string) => void
}

export default function RenameTerminalDialog({
	session,
	onOpenChange,
	onRename,
}: RenameTerminalDialogProps) {
	const [name, setName] = useState('')

	useEffect(() => {
		setName(session?.name ?? '')
	}, [session])

	const submit = () => {
		if (!session) return
		const normalized = normalizeTerminalTabName(name)
		if (!normalized) return
		onRename(session.id, normalized)
		onOpenChange(false)
	}

	return (
		<Dialog open={session !== null} onOpenChange={onOpenChange}>
			<DialogContent variant="terminal" className="max-w-md gap-5 border-[var(--term-border)]">
				<DialogHeader kicker="SSH SESSION">
					<DialogTitle className="text-base">重命名终端</DialogTitle>
					<DialogDescription className="text-xs text-[var(--term-muted)]">
						为当前会话设置一个易识别的名称，仅保存在此浏览器中。
					</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-5"
					onSubmit={(event) => {
						event.preventDefault()
						submit()
					}}
				>
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-3">
							<label htmlFor="terminal-tab-name" className="text-xs text-[var(--term-title)]">
								标签名称
							</label>
							<span className="font-mono text-[11px] tabular-nums text-[var(--term-dim)]">
								{name.length}/{TERMINAL_TAB_NAME_MAX_LENGTH}
							</span>
						</div>
						<Input
							id="terminal-tab-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							onFocus={(event) => event.currentTarget.select()}
							maxLength={TERMINAL_TAB_NAME_MAX_LENGTH}
							autoFocus
							autoComplete="off"
							placeholder="例如：生产服务器"
							className="border-[var(--term-border)] bg-black/20 font-mono text-[var(--term-title)] placeholder:text-[var(--term-dim)] focus-visible:border-sky-400/70"
						/>
					</div>
					<DialogFooter className="border-[var(--term-border)] sm:space-x-0">
						<Button type="button" variant="default" size="sm" onClick={() => onOpenChange(false)}>
							取消
						</Button>
						<Button type="submit" variant="default" size="sm" disabled={!name.trim()}>
							保存名称
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
