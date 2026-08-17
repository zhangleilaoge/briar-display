'use client'

import { uploadAvatar } from '@/api/users'
import UserMenu from '@/components/common/UserMenu'
import MessagesPanel from '@/components/profile/MessagesPanel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionProvider, syncUserToStorage, usePermissions } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { PERMISSIONS } from '@briar/shared'
import {
	AlertCircle,
	Calendar,
	Camera,
	KeyRound,
	Loader2,
	Mail,
	Shield,
	User as UserIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'

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
	const { user, roles, permissions, loading: permsLoading, refresh } = usePermissions()
	const { unread } = useUnreadMessages()
	const [uploading, setUploading] = useState(false)
	const [uploadError, setUploadError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	// 支持 ?tab=messages 直达站内信页签
	const [tab, setTab] = useState(() => {
		if (typeof window === 'undefined') return 'profile'
		return new URLSearchParams(window.location.search).get('tab') === 'messages'
			? 'messages'
			: 'profile'
	})

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

	const handleAvatarClick = () => {
		fileInputRef.current?.click()
	}

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		setUploading(true)
		setUploadError(null)
		try {
			const res = await uploadAvatar(file)
			if (res.success && res.data) {
				// 刷新 PermissionContext 并同步本地缓存
				await refresh()
				if (user) {
					syncUserToStorage({ ...user, ...res.data, roles, permissions })
				}
			} else {
				setUploadError(res.message || '上传失败')
			}
		} catch (err: any) {
			setUploadError(err?.response?.data?.message || err?.message || '上传失败')
		} finally {
			setUploading(false)
			if (fileInputRef.current) fileInputRef.current.value = ''
		}
	}

	const avatarUrl = user?.avatar
	const initial = user?.name?.charAt(0)?.toUpperCase() || 'U'

	return (
		<div className="min-h-screen bg-background">
			{/* 顶部导航 */}
			<header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-md">
				<a href="/briar/" className="text-sm font-semibold text-foreground">
					Briar
				</a>
				<UserMenu variant="light" />
			</header>

			<main className="mx-auto max-w-5xl p-6">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">个人中心</h1>
					<p className="mt-1 text-sm text-muted-foreground">管理你的账号信息、角色与权限</p>
				</div>

				<Tabs
					orientation="vertical"
					value={tab}
					onValueChange={setTab}
					className="mt-6 flex flex-col gap-6 md:flex-row"
				>
					<TabsList className="h-auto w-full shrink-0 flex-row justify-start gap-1 bg-transparent p-0 md:w-44 md:flex-col md:items-stretch">
						<TabsTrigger
							value="profile"
							className="justify-start gap-2 px-3 py-2 data-[state=active]:bg-accent data-[state=active]:shadow-none md:w-full"
						>
							<UserIcon className="h-3.5 w-3.5" />
							基本信息
						</TabsTrigger>
						<TabsTrigger
							value="messages"
							className="justify-start gap-2 px-3 py-2 data-[state=active]:bg-accent data-[state=active]:shadow-none md:w-full"
						>
							<Mail className="h-3.5 w-3.5" />
							站内信
							{unread > 0 && (
								<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
									{unread > 99 ? '99+' : unread}
								</span>
							)}
						</TabsTrigger>
					</TabsList>

					<div className="min-w-0 flex-1">
						<TabsContent value="profile" className="mt-0 space-y-6">
							{/* 头像 */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-base">
										<UserIcon className="h-4 w-4" />
										头像
									</CardTitle>
									<CardDescription>点击头像可更换</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex items-center gap-4">
										<button
											type="button"
											onClick={handleAvatarClick}
											disabled={uploading}
											className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
										>
											{avatarUrl ? (
												<img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
											) : (
												<span className="text-2xl font-semibold text-muted-foreground">
													{initial}
												</span>
											)}
											<span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
												{uploading ? (
													<Loader2 className="h-6 w-6 animate-spin" />
												) : (
													<Camera className="h-6 w-6" />
												)}
											</span>
										</button>
										<div className="space-y-1">
											<p className="text-sm font-medium">{user?.name || '用户'}</p>
											<p className="text-xs text-muted-foreground">
												支持 JPG、PNG、GIF、WebP、AVIF，最大 2MB
											</p>
											{uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
										</div>
									</div>
									<input
										ref={fileInputRef}
										type="file"
										accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
										className="hidden"
										onChange={handleFileChange}
									/>
								</CardContent>
							</Card>

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
									<InfoRow
										icon={<UserIcon className="h-4 w-4" />}
										label="用户名"
										value={user?.name}
									/>
									<InfoRow icon={<Mail className="h-4 w-4" />} label="邮箱" value={user?.email} />
									<InfoRow
										icon={<Calendar className="h-4 w-4" />}
										label="注册时间"
										value={
											user?.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : undefined
										}
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
										href="/briar/forgot-password"
										className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
									>
										<KeyRound className="h-3.5 w-3.5" />
										修改密码
									</a>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="messages" className="mt-0">
							<MessagesPanel />
						</TabsContent>
					</div>
				</Tabs>
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
