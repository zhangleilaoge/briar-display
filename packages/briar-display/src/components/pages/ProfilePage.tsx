'use client'

import { updateMe, uploadAvatar } from '@/api/users'
import UserMenu from '@/components/common/UserMenu'
import LoginMethodsCard from '@/components/profile/LoginMethodsCard'
import MergeHistoryCard from '@/components/profile/MergeHistoryCard'
import MessagesPanel from '@/components/profile/MessagesPanel'
import { ScrapStickerDecor } from '@/components/portal/ScrapStickerDecor'
import { ProfileSheet, ProfileSheetHeader } from '@/components/profile/ProfileSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider, syncUserToStorage, usePermissions } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { PERMISSIONS } from '@briar/shared'
import {
	AlertCircle,
	Calendar,
	Camera,
	Check,
	KeyRound,
	Loader2,
	Mail,
	Pencil,
	Shield,
	User as UserIcon,
	X,
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
	const { loading: permLoading, denied } = useRequirePermission(undefined, [
		PERMISSIONS.PAGE_BUSINESS,
	])
	const { user, roles, permissions, loading: permsLoading, refresh } = usePermissions()
	const { unread } = useUnreadMessages()
	const [uploading, setUploading] = useState(false)
	const [uploadError, setUploadError] = useState<string | null>(null)
	const [editingName, setEditingName] = useState(false)
	const [nameDraft, setNameDraft] = useState('')
	const [savingName, setSavingName] = useState(false)
	const [nameError, setNameError] = useState<string | null>(null)
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
			<ThemeShell variant="scrapbook" className="flex items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</ThemeShell>
		)
	}

	if (denied) {
		return (
			<ThemeShell
				variant="scrapbook"
				className="flex items-center justify-center gap-2 text-muted-foreground"
			>
				<AlertCircle className="h-5 w-5" />
				<span>你没有权限访问此页面</span>
			</ThemeShell>
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

	const startEditName = () => {
		setNameDraft(user?.name || '')
		setNameError(null)
		setEditingName(true)
	}

	const cancelEditName = () => {
		setEditingName(false)
		setNameError(null)
	}

	const saveName = async () => {
		const trimmed = nameDraft.trim()
		if (!trimmed) {
			setNameError('用户名不能为空')
			return
		}
		if (trimmed.length > 32) {
			setNameError('用户名最多 32 个字符')
			return
		}
		if (trimmed === user?.name) {
			setEditingName(false)
			return
		}
		setSavingName(true)
		setNameError(null)
		try {
			const res = await updateMe({ name: trimmed })
			if (res.success && res.data) {
				await refresh()
				syncUserToStorage({ ...user!, ...res.data, roles, permissions })
				setEditingName(false)
			} else {
				setNameError(res.message || '保存失败')
			}
		} catch (err: any) {
			setNameError(err?.response?.data?.message || err?.message || '保存失败')
		} finally {
			setSavingName(false)
		}
	}

	const avatarUrl = user?.avatar
	const initial = user?.name?.charAt(0)?.toUpperCase() || 'U'

	return (
		<ThemeShell variant="scrapbook">
			{/* 背景剪纸：与门户/想法同规则，落左右 gutter */}
			<ScrapStickerDecor page="profile" seedKey="profile" />
			{/* 顶部导航 */}
			<PageHeader crumbs={[{ label: '个人中心' }]} />

			<main className="mx-auto max-w-5xl p-4 sm:p-6">
				<div>
					<span className="rv-script text-2xl text-[color:var(--rv-rose-deep)]">Mon carnet</span>
					<h1 className="text-3xl font-semibold tracking-tight">个人中心</h1>
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
							className="justify-start gap-2 px-3 py-2 data-[state=active]:shadow-control md:w-full"
						>
							<UserIcon className="h-3.5 w-3.5" />
							基本信息
						</TabsTrigger>
						<TabsTrigger
							value="messages"
							className="justify-start gap-2 px-3 py-2 data-[state=active]:shadow-control md:w-full"
						>
							<Mail className="h-3.5 w-3.5" />
							站内信
							{unread > 0 && (
								<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
									{unread > 99 ? '99+' : unread}
								</span>
							)}
						</TabsTrigger>
					</TabsList>

					<div className="min-w-0 flex-1">
						<TabsContent value="profile" className="mt-0 space-y-6">
							{/* 头像 */}
							<ProfileSheet>
								<ProfileSheetHeader
									icon={<UserIcon className="h-4 w-4" />}
									title="头像"
									description="点击头像可更换"
								/>
								<div>
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
								</div>
							</ProfileSheet>

							{/* 基本信息 */}
							<ProfileSheet>
								<ProfileSheetHeader
									icon={<UserIcon className="h-4 w-4" />}
									title="基本信息"
									description="你的账号资料"
								/>
								<div className="space-y-3">
									<div className="flex items-start justify-between gap-3 border-b border-border/40 py-2">
										<div className="flex shrink-0 items-center gap-2 pt-1.5 text-sm text-muted-foreground">
											<UserIcon className="h-4 w-4" />
											<span>用户名</span>
										</div>
										<div className="min-w-0 flex-1">
											{editingName ? (
												<div className="space-y-2">
													<Input
														value={nameDraft}
														onChange={(e) => setNameDraft(e.target.value.slice(0, 32))}
														disabled={savingName}
														className="h-9 rounded-none text-right"
														autoFocus
														onKeyDown={(e) => {
															if (e.key === 'Enter') void saveName()
															if (e.key === 'Escape') cancelEditName()
														}}
													/>
													<div className="flex justify-end gap-2">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="h-8 rounded-none px-2"
															onClick={cancelEditName}
															disabled={savingName}
														>
															<X className="mr-1 h-3.5 w-3.5" />
															取消
														</Button>
														<Button
															type="button"
															size="sm"
															className="h-8 rounded-none px-3"
															onClick={() => void saveName()}
															disabled={savingName}
														>
															{savingName ? (
																<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
															) : (
																<Check className="mr-1 h-3.5 w-3.5" />
															)}
															保存
														</Button>
													</div>
													{nameError && (
														<p className="text-right text-xs text-destructive">{nameError}</p>
													)}
												</div>
											) : (
												<div className="flex items-center justify-end gap-2">
													<span className="truncate text-sm font-medium">{user?.name || '—'}</span>
													<button
														type="button"
														onClick={startEditName}
														className="inline-flex items-center gap-1 rounded-none px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
													>
														<Pencil className="h-3 w-3" />
														编辑
													</button>
												</div>
											)}
										</div>
									</div>
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
								</div>
							</ProfileSheet>

							{/* 角色 */}
							<ProfileSheet>
								<ProfileSheetHeader
									icon={<Shield className="h-4 w-4" />}
									title="角色"
									description="你当前被分配的角色"
								/>
								<div>
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
								</div>
							</ProfileSheet>

							{/* 权限 */}
							<ProfileSheet>
								<ProfileSheetHeader
									icon={<KeyRound className="h-4 w-4" />}
									title={
										<>
											权限{' '}
											<span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
												{' '}
												{permissions.length}{' '}
											</span>
										</>
									}
									description="你拥有的全部权限编码（管理员拥有所有权限）"
								/>
								<div>
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
								</div>
							</ProfileSheet>

							{/* 登录方式（含修改密码，原「安全」卡片并入此处） */}
							<LoginMethodsCard email={user?.email} />

							{/* 账号合并记录（无记录时不显示） */}
							<MergeHistoryCard userId={user?.id} />
						</TabsContent>

						<TabsContent value="messages" className="mt-0">
							<MessagesPanel />
						</TabsContent>
					</div>
				</Tabs>
			</main>
		</ThemeShell>
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
			<div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
				{icon}
				<span>{label}</span>
			</div>
			<span
				className={`min-w-0 truncate text-right ${mono ? 'font-mono text-xs text-foreground/80' : 'text-sm font-medium'}`}
			>
				{value || '—'}
			</span>
		</div>
	)
}
