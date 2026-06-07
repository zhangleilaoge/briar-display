'use client'

import { getRoles, getUsers, setUserRoles } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import type { Role } from '@briar/shared'
import { AlertCircle, Check, Loader2, Search, Shield, User, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AdminLayout from './AdminLayout'
import AdminPagination from './AdminPagination'

interface UserWithRoles {
	userId: string
	userName: string
	userEmail: string
	roles: Role[]
}

const PAGE_SIZE = 20

export default function AdminUsersPage() {
	return (
		<PermissionProvider>
			<AdminUsersPageInner />
		</PermissionProvider>
	)
}

function AdminUsersPageInner() {
	const {
		loading: permLoading,
		authorized,
		denied,
	} = useRequirePermission('admin:user-role:assign')
	const [users, setUsers] = useState<UserWithRoles[]>([])
	const [allRoles, setAllRoles] = useState<Role[]>([])
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [keyword, setKeyword] = useState('')
	const [page, setPage] = useState(1)
	const [total, setTotal] = useState(0)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>()

	const [editingUserId, setEditingUserId] = useState<string | null>(null)
	const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())

	const fetchUsers = useCallback(async (kw: string, p: number) => {
		try {
			setLoading(true)
			const res = await getUsers({ keyword: kw || undefined, page: p, pageSize: PAGE_SIZE })
			if (res.success && res.data) {
				setUsers(res.data.items)
				setTotal(res.data.total)
			}
		} catch {
			setError('加载用户数据失败')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		;(async () => {
			try {
				const rolesRes = await getRoles()
				if (rolesRes.success) setAllRoles(rolesRes.data || [])
			} catch {
				// ignore
			}
		})()
	}, [])

	useEffect(() => {
		fetchUsers(keyword, page)
	}, [keyword, page, fetchUsers])

	const handleSearchChange = (value: string) => {
		setSearch(value)
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			setKeyword(value)
			setPage(1)
		}, 300)
	}

	const startEditing = (user: UserWithRoles) => {
		setEditingUserId(user.userId)
		setSelectedRoleIds(new Set(user.roles.map((r) => r.id)))
	}

	const cancelEditing = () => {
		setEditingUserId(null)
		setSelectedRoleIds(new Set())
	}

	const handleSave = async (userId: string) => {
		setSaving(true)
		try {
			const res = await setUserRoles(userId, Array.from(selectedRoleIds))
			if (res.success) {
				setEditingUserId(null)
				await fetchUsers(keyword, page)
			} else {
				setError(res.message || '保存失败')
			}
		} catch {
			setError('保存用户角色失败')
		} finally {
			setSaving(false)
		}
	}

	const toggleRole = (roleId: string) => {
		setSelectedRoleIds((prev) => {
			const next = new Set(prev)
			if (next.has(roleId)) next.delete(roleId)
			else next.add(roleId)
			return next
		})
	}

	if (permLoading || loading) {
		return (
			<AdminLayout currentPath="/briar-display/admin/users" title="用户角色">
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</AdminLayout>
		)
	}

	if (denied) {
		return (
			<AdminLayout currentPath="/briar-display/admin/users" title="用户角色">
				<Card>
					<CardContent className="flex items-center gap-2 pt-6">
						<AlertCircle className="h-5 w-5 text-destructive" />
						<span>你没有权限访问此页面</span>
					</CardContent>
				</Card>
			</AdminLayout>
		)
	}

	return (
		<AdminLayout currentPath="/briar-display/admin/users" title="用户角色">
			<Card>
				<CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
					<CardTitle className="flex items-center gap-2 text-lg">
						<User className="h-5 w-5" />
						用户角色管理
					</CardTitle>
					<div className="relative w-64">
						<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="搜索用户名或邮箱..."
							value={search}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="h-9 pl-8"
						/>
					</div>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<span className="flex-1">{error}</span>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={() => setError(null)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					)}

					{loading ? (
						<div className="flex items-center justify-center py-20">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>用户</TableHead>
										<TableHead>邮箱</TableHead>
										<TableHead>当前角色</TableHead>
										<TableHead>操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{users.map((user) => (
										<TableRow key={user.userId}>
											<TableCell>
												<div className="flex items-center gap-2">
													<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
														<User className="h-4 w-4 text-muted-foreground" />
													</div>
													<span className="font-medium">{user.userName}</span>
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground">{user.userEmail}</TableCell>
											<TableCell>
												{editingUserId === user.userId ? (
													<div className="flex flex-wrap gap-2">
														{allRoles.map((role) => (
															<label
																key={role.id}
																className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
															>
																<Checkbox
																	checked={selectedRoleIds.has(role.id)}
																	onCheckedChange={() => toggleRole(role.id)}
																	className="h-3.5 w-3.5"
																/>
																<span>{role.displayName}</span>
															</label>
														))}
													</div>
												) : (
													<div className="flex flex-wrap gap-1">
														{user.roles.length > 0 ? (
															user.roles.map((role) => (
																<Badge key={role.id} variant="secondary" className="gap-1">
																	<Shield className="h-3 w-3" />
																	{role.displayName}
																</Badge>
															))
														) : (
															<span className="text-muted-foreground">未分配角色</span>
														)}
													</div>
												)}
											</TableCell>
											<TableCell>
												{editingUserId === user.userId ? (
													<div className="flex gap-1">
														<Button
															size="sm"
															onClick={() => handleSave(user.userId)}
															disabled={saving}
															className="gap-1"
														>
															{saving ? (
																<Loader2 className="h-3 w-3 animate-spin" />
															) : (
																<Check className="h-3 w-3" />
															)}
															保存
														</Button>
														<Button size="sm" variant="ghost" onClick={cancelEditing}>
															取消
														</Button>
													</div>
												) : (
													<Button size="sm" variant="outline" onClick={() => startEditing(user)}>
														编辑角色
													</Button>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>

							{users.length === 0 && (
								<div className="py-16 text-center text-muted-foreground">
									{keyword ? '没有匹配的用户' : '暂无用户'}
								</div>
							)}

							<AdminPagination
								total={total}
								limit={PAGE_SIZE}
								offset={(page - 1) * PAGE_SIZE}
								onPageChange={(offset) => setPage(Math.floor(offset / PAGE_SIZE) + 1)}
							/>
						</>
					)}
				</CardContent>
			</Card>
		</AdminLayout>
	)
}
