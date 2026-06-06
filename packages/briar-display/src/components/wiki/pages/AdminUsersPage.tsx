'use client'

import { getRoles, getUsers, setUserRoles } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import { usePermissions } from '@/contexts/PermissionContext'
import type { Role } from '@briar/shared'
import { AlertCircle, Check, Loader2, Search, Settings, Shield, User, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface UserWithRoles {
	userId: string
	userName: string
	userEmail: string
	roles: Role[]
}

export default function AdminUsersPage() {
	const { hasPermission, isAdmin } = usePermissions()
	const [users, setUsers] = useState<UserWithRoles[]>([])
	const [allRoles, setAllRoles] = useState<Role[]>([])
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')

	// 当前正在编辑角色的用户
	const [editingUserId, setEditingUserId] = useState<string | null>(null)
	const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())

	const canManage = hasPermission('admin:user-role:assign') || isAdmin

	const fetchData = useCallback(async () => {
		try {
			setLoading(true)
			const [usersRes, rolesRes] = await Promise.all([getUsers(), getRoles()])
			if (usersRes.success) setUsers(usersRes.data || [])
			if (rolesRes.success) setAllRoles(rolesRes.data || [])
		} catch {
			setError('加载数据失败')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchData()
	}, [fetchData])

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
				await fetchData()
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

	const filteredUsers = users.filter(
		(u) =>
			!search ||
			u.userName.toLowerCase().includes(search.toLowerCase()) ||
			u.userEmail.toLowerCase().includes(search.toLowerCase()),
	)

	if (!canManage) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: '管理后台' }, { label: '用户角色' }]} />
				<div className="flex items-center gap-2 rounded border border-wiki-border-light bg-wiki-bg-secondary p-4 text-wiki-text-secondary">
					<AlertCircle className="h-5 w-5" />
					<span>你没有权限访问此页面</span>
				</div>
			</div>
		)
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-6 w-6 animate-spin text-wiki-text-muted" />
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '管理后台' }, { label: '用户角色' }]} />

			<div className="flex items-center gap-3">
				<Settings className="h-6 w-6 text-wiki-link" />
				<h1 className="text-xl font-semibold text-wiki-text">用户角色管理</h1>
			</div>

			{error && (
				<div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
					<AlertCircle className="h-4 w-4" />
					{error}
					<button type="button" onClick={() => setError(null)} className="ml-auto">
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			{/* 搜索 */}
			<div className="relative max-w-sm">
				<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-wiki-text-muted" />
				<Input
					placeholder="搜索用户名或邮箱..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="h-8 pl-8 text-[13px]"
				/>
			</div>

			{/* 用户列表 */}
			<div className="overflow-x-auto">
				<table className="w-full text-[13px]">
					<thead>
						<tr className="border-b border-wiki-border-light text-left text-wiki-text-muted">
							<th className="pb-2 pr-4 font-medium">用户</th>
							<th className="pb-2 pr-4 font-medium">邮箱</th>
							<th className="pb-2 pr-4 font-medium">当前角色</th>
							<th className="pb-2 font-medium">操作</th>
						</tr>
					</thead>
					<tbody>
						{filteredUsers.map((user) => (
							<tr key={user.userId} className="border-b border-wiki-border-light/50">
								<td className="py-2.5 pr-4">
									<div className="flex items-center gap-2">
										<User className="h-4 w-4 text-wiki-text-muted" />
										<span className="font-medium text-wiki-text">{user.userName}</span>
									</div>
								</td>
								<td className="py-2.5 pr-4 text-wiki-text-secondary">{user.userEmail}</td>
								<td className="py-2.5 pr-4">
									{editingUserId === user.userId ? (
										<div className="flex flex-wrap gap-2">
											{allRoles.map((role) => (
												<label
													key={role.id}
													className="flex cursor-pointer items-center gap-1.5 rounded border border-wiki-border-light px-2 py-1 hover:bg-wiki-bg-secondary"
												>
													<input
														type="checkbox"
														checked={selectedRoleIds.has(role.id)}
														onChange={() => toggleRole(role.id)}
														className="h-3.5 w-3.5 rounded border-wiki-border"
													/>
													<span>{role.displayName}</span>
												</label>
											))}
										</div>
									) : (
										<div className="flex flex-wrap gap-1">
											{user.roles.length > 0 ? (
												user.roles.map((role) => (
													<span
														key={role.id}
														className="inline-flex items-center gap-1 rounded bg-wiki-bg-tertiary px-2 py-0.5 text-[12px] text-wiki-text-secondary"
													>
														<Shield className="h-3 w-3" />
														{role.displayName}
													</span>
												))
											) : (
												<span className="text-wiki-text-muted">未分配角色</span>
											)}
										</div>
									)}
								</td>
								<td className="py-2.5">
									{editingUserId === user.userId ? (
										<div className="flex gap-1">
											<Button
												size="sm"
												onClick={() => handleSave(user.userId)}
												disabled={saving}
												className="h-7 gap-1 text-xs"
											>
												{saving ? (
													<Loader2 className="h-3 w-3 animate-spin" />
												) : (
													<Check className="h-3 w-3" />
												)}
												保存
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={cancelEditing}
												className="h-7 text-xs"
											>
												取消
											</Button>
										</div>
									) : (
										<Button
											size="sm"
											variant="ghost"
											onClick={() => startEditing(user)}
											className="h-7 text-xs"
										>
											编辑角色
										</Button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{filteredUsers.length === 0 && (
				<div className="py-10 text-center text-sm text-wiki-text-muted">
					{search ? '没有匹配的用户' : '暂无用户'}
				</div>
			)}
		</div>
	)
}
