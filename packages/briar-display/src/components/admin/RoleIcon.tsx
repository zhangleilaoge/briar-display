import { cn } from '@/lib/utils'
import { Crown, KeyRound, type LucideIcon, ShieldCheck, UserRound } from 'lucide-react'

const ROLE_ICONS: Record<string, LucideIcon> = {
	admin: Crown,
	moderator: ShieldCheck,
	user: UserRound,
}

export function RoleIcon({ name, className }: { name: string; className?: string }) {
	const Icon = ROLE_ICONS[name] || KeyRound
	return <Icon className={cn('shrink-0', className)} aria-hidden />
}
