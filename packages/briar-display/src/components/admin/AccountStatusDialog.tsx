'use client'

import { setUserStatus } from '@/api/admin'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export interface AccountStatusTarget {
	userId: string
	userName: string
	userEmail: string
	disabledAt: string | null
}

interface Props {
	target: AccountStatusTarget | null
	onOpenChange: (open: boolean) => void
	onChanged: (disabledAt: string | null) => void
}

export default function AccountStatusDialog({ target, onOpenChange, onChanged }: Props) {
	const [saving, setSaving] = useState(false)
	const disabling = !target?.disabledAt

	const handleConfirm = async () => {
		if (!target) return
		setSaving(true)
		try {
			const res = await setUserStatus(target.userId, disabling)
			if (!res.success || !res.data) {
				toast.error(res.message || '账号状态更新失败')
				return
			}
			onChanged(res.data.disabledAt)
			toast.success(disabling ? `已禁用 ${target.userName}` : `已启用 ${target.userName}`)
			onOpenChange(false)
		} catch (error) {
			const message = (error as { response?: { data?: { message?: string } } })?.response?.data
				?.message
			toast.error(message || '账号状态更新失败，请稍后重试')
		} finally {
			setSaving(false)
		}
	}

	return (
		<Dialog open={!!target} onOpenChange={(open) => !saving && onOpenChange(open)}>
			<DialogContent className="max-w-md gap-0">
				<DialogHeader>
					<DialogTitle>{disabling ? '禁用账号' : '启用账号'}</DialogTitle>
				</DialogHeader>
				<DialogDescription className="py-1 leading-6">
					{disabling
						? `禁用 ${target?.userName}（${target?.userEmail}）后，该账号的现有登录态会立即失效，也不能通过密码、Google 或重置密码重新登录。`
						: `启用 ${target?.userName}（${target?.userEmail}）后，该账号可以重新登录。`}
				</DialogDescription>
				<DialogFooter className="mt-5">
					<Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button
						variant={disabling ? 'destructive' : 'default'}
						disabled={saving}
						onClick={handleConfirm}
					>
						{saving && <Loader2 className="h-4 w-4 animate-spin" />}
						确认{disabling ? '禁用' : '启用'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
