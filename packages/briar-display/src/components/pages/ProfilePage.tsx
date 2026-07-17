'use client'

import UserMenu from '@/components/common/UserMenu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { PERMISSIONS } from '@briar/shared'
import {
	AlertCircle,
	Calendar,
	KeyRound,
	Loader2,
	Mail,
	Shield,
	User as UserIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ProfilePage() {
	return (
		<PermissionProvider>
			<ProfilePageInner />
		</PermissionProvider>
	)
}

function ProfilePageInner() {
	// 个人中心要求最低登录态：page:business 是图床用的，profile 用更宽松的 page:wiki
	// 没有 page:wiki 的人也不该进，那就 fallback 到 page:business
	// 这里直接要求登录即可，不卡具体业务权限
	const { loading: permLoading, denied } = useRequirePermission(undefined, [
		PERMISSIONS.PAGE_WIKI,
		PERMISSIONS.PAGE_BUSINESS,
		PERMISSIONS.PAGE_ADMIN,
	])
	const { user, roles, permissions, isAdmin, loading: permsLoading } = usePermissions()

	if (permLoading || permsLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (denied) {
		return (
			<div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
				<AlertCircle className="h-5 w-5" />
				<span>你没有权限访问此页面</span>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-background">
			{/* 顶部导航 */}
			<header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-md">
				<a href="/briar-display/" className="text-sm font-semibold text-foreground">
					Briar
				</a>
				<UserMenu variant="light" />
			</header>

			<main className="mx-auto max-w-3xl space-y-6 p-6">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">个人中心</h1>
					<p className="mt-1 text-sm text-muted-foreground">管理你的账号信息、角色与权限</p>
				</div>

				{/* 基本信息 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<UserIcon className="h-4 w-4" />
							基本信息
						</CardTitle>
						<CardDescription>你的账号资料</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<InfoRow icon={<UserIcon className="h-4 w-4" />} label="用户名" value={user?.name} />
						<InfoRow icon={<Mail className="h-4 w-4" />} label="邮箱" value={user?.email} />
						<InfoRow
							icon={<Calendar className="h-4 w-4" />}
							label="注册时间"
							value={user?.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : undefined}
						/>
						<InfoRow
							icon={<KeyRound className="h-4 w-4" />}
							label="用户 ID"
							value={user?.id}
							mono
						/>
					</CardContent>
				</Card>

				{/* 角色 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Shield className="h-4 w-4" />
							角色
							{isAdmin && (
								<span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
									管理员
								</span>
							)}
						</CardTitle>
						<CardDescription>你当前被分配的角色</CardDescription>
					</CardHeader>
					<CardContent>
						{roles.length === 0 ? (
							<p className="text-sm text-muted-foreground">暂未分配任何角色</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{roles.map((r) => (
									<div
										key={r.id}
										className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-sm"
									>
										<Shield className="h-3 w-3 text-muted-foreground" />
										<span className="font-medium">{r.displayName}</span>
										{r.description && (
											<span className="text-xs text-muted-foreground">· {r.description}</span>
										)}
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* 权限 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<KeyRound className="h-4 w-4" />
							权限
							<span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
								{permissions.length}
							</span>
						</CardTitle>
						<CardDescription>你拥有的全部权限编码（管理员拥有所有权限）</CardDescription>
					</CardHeader>
					<CardContent>
						{permissions.length === 0 ? (
							<p className="text-sm text-muted-foreground">暂未分配任何权限</p>
						) : (
							<div className="flex flex-wrap gap-1.5">
								{permissions.map((code) => (
									<code
										key={code}
										className="rounded border bg-muted/30 px-1.5 py-0.5 font-mono text-[11px] text-foreground"
									>
										{code}
									</code>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* 安全 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<KeyRound className="h-4 w-4" />
							安全
						</CardTitle>
						<CardDescription>账号安全相关操作</CardDescription>
					</CardHeader>
					<CardContent>
						<a
							href="/briar-display/forgot-password"
							className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
						>
							<KeyRound className="h-3.5 w-3.5" />
							修改密码
						</a>
					</CardContent>
				</Card>
			</main>
		</div>
	)
}

interface InfoRowProps {
	icon: React.ReactNode
	label: string
	value: string | undefined | null
	mono?: boolean
}

function InfoRow({ icon, label, value, mono }: InfoRowProps) {
	return (
		<div className="flex items-center justify-between gap-3 border-b border-border/40 py-2 last:border-0">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				{icon}
				<span>{label}</span>
			</div>
			<span className={mono ? 'font-mono text-xs text-foreground/80' : 'text-sm font-medium'}>
				{value || '—'}
			</span>
		</div>
	)
}
