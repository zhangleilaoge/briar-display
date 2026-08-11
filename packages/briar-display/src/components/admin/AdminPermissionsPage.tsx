'use client'

import {
	createRole,
	deleteRole,
	getPermissions,
	getRoleDetail,
	getRoles,
	setRolePermissions,
	updateRole,
} from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import {
	PERMISSION_GROUPS,
	type Permission,
	type Role,
	type RoleWithPermissions,
} from '@briar/shared'
import {
	AlertCircle,
	Check,
	ChevronRight,
	Loader2,
	Pencil,
	Plus,
	Shield,
	Trash2,
	X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import AdminLayout from './AdminLayout'

export default function AdminPermissionsPage() {
	return (
		<PermissionProvider>
			<AdminPermissionsPageInner />
		</PermissionProvider>
	)
}

function AdminPermissionsPageInner() {
	const { loading: permLoading, authorized, denied } = useRequirePermission('admin:role:manage')
	const [roles, setRoles] = useState<Role[]>([])
	const [allPermissions, setAllPermissions] = useState<Permission[]>([])
	const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const [showCreateForm, setShowCreateForm] = useState(false)
	const [newRoleName, setNewRoleName] = useState('')
	const [newRoleDisplayName, setNewRoleDisplayName] = useState('')
	const [newRoleDescription, setNewRoleDescription] = useState('')

	const [editingRole, setEditingRole] = useState<string | null>(null)
	const [editDisplayName, setEditDisplayName] = useState('')
	const [editDescription, setEditDescription] = useState('')

	const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set())

	const fetchData = useCallback(async () => {
		try {
			setLoading(true)
			const [rolesRes, permsRes] = await Promise.all([getRoles(), getPermissions()])
			if (rolesRes.success) setRoles(rolesRes.data || [])
			if (permsRes.success) setAllPermissions(permsRes.data || [])
		} catch {
			setError('加载数据失败')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchData()
	}, [fetchData])

	const loadRoleDetail = async (roleId: string) => {
		try {
			const res = await getRoleDetail(roleId)
			if (res.success && res.data) {
				setSelectedRole(res.data)
				setSelectedPermIds(new Set(res.data.permissions.map((p) => p.id)))
			}
		} catch {
			setError('加载角色详情失败')
		}
	}

	const handleCreateRole = async () => {
		if (!newRoleName.trim() || !newRoleDisplayName.trim()) return
		setSaving(true)
		try {
			const res = await createRole({
				name: newRoleName.trim(),
				displayName: newRoleDisplayName.trim(),
				description: newRoleDescription.trim() || undefined,
			})
			if (res.success) {
				setShowCreateForm(false)
				setNewRoleName('')
				setNewRoleDisplayName('')
				setNewRoleDescription('')
				await fetchData()
			} else {
				setError(res.message || '创建失败')
			}
		} catch {
			setError('创建角色失败')
		} finally {
			setSaving(false)
		}
	}

	const handleUpdateRole = async (roleId: string) => {
		setSaving(true)
		try {
			const res = await updateRole(roleId, {
				displayName: editDisplayName.trim(),
				description: editDescription.trim() || undefined,
			})
			if (res.success) {
				setEditingRole(null)
				await fetchData()
				if (selectedRole?.id === roleId) await loadRoleDetail(roleId)
			}
		} catch {
			setError('更新角色失败')
		} finally {
			setSaving(false)
		}
	}

	const handleDeleteRole = async (roleId: string) => {
		if (!confirm('确定要删除此角色吗？')) return
		try {
			const res = await deleteRole(roleId)
			if (res.success) {
				if (selectedRole?.id === roleId) setSelectedRole(null)
				await fetchData()
			} else {
				setError(res.message || '删除失败')
			}
		} catch {
			setError('删除角色失败')
		}
	}

	const handleSavePermissions = async () => {
		if (!selectedRole) return
		setSaving(true)
		try {
			await setRolePermissions(selectedRole.id, Array.from(selectedPermIds))
			await loadRoleDetail(selectedRole.id)
		} catch {
			setError('保存权限失败')
		} finally {
			setSaving(false)
		}
	}

	const togglePermission = (permId: string) => {
		setSelectedPermIds((prev) => {
			const next = new Set(prev)
			if (next.has(permId)) next.delete(permId)
			else next.add(permId)
			return next
		})
	}

	const toggleModulePermissions = (modulePerms: { code: string }[]) => {
		const permIds = modulePerms
			.map((mp) => allPermissions.find((p) => p.code === mp.code)?.id)
			.filter(Boolean) as string[]
		const allSelected = permIds.every((id) => selectedPermIds.has(id))

		setSelectedPermIds((prev) => {
			const next = new Set(prev)
			for (const id of permIds) {
				if (allSelected) next.delete(id)
				else next.add(id)
			}
			return next
		})
	}

	if (permLoading || loading) {
		return (
			<AdminLayout currentPath="/briar/admin/permissions" title="权限管理">
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</AdminLayout>
		)
	}

	if (denied) {
		return (
			<AdminLayout currentPath="/briar/admin/permissions" title="权限管理">
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
		<AdminLayout currentPath="/briar/admin/permissions" title="权限管理">
			<div className="mb-4 flex items-center gap-2">
				<Shield className="h-5 w-5" />
				<h1 className="text-lg font-semibold">角色与权限管理</h1>
			</div>

			{error && (
				<div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
					<AlertCircle className="h-4 w-4 shrink-0" />
					<span className="flex-1">{error}</span>
					<Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setError(null)}>
						<X className="h-4 w-4" />
					</Button>
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-[300px_1fr]">
				{/* 左侧：角色列表 */}
				<Card>
					<CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
						<CardTitle className="text-sm">角色列表</CardTitle>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setShowCreateForm(true)}
							className="h-7 gap-1 text-xs"
						>
							<Plus className="h-3 w-3" />
							新建
						</Button>
					</CardHeader>
					<CardContent className="space-y-2">
						{showCreateForm && (
							<div className="space-y-2 rounded-md border bg-muted/50 p-3">
								<Input
									placeholder="角色标识（英文）"
									value={newRoleName}
									onChange={(e) => setNewRoleName(e.target.value)}
									className="h-8 text-sm"
								/>
								<Input
									placeholder="显示名称"
									value={newRoleDisplayName}
									onChange={(e) => setNewRoleDisplayName(e.target.value)}
									className="h-8 text-sm"
								/>
								<Input
									placeholder="描述（可选）"
									value={newRoleDescription}
									onChange={(e) => setNewRoleDescription(e.target.value)}
									className="h-8 text-sm"
								/>
								<div className="flex gap-2">
									<Button size="sm" onClick={handleCreateRole} disabled={saving}>
										创建
									</Button>
									<Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>
										取消
									</Button>
								</div>
							</div>
						)}

						<div className="space-y-1">
							{roles.map((role) => (
								<button
									type="button"
									key={role.id}
									className={`group flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
										selectedRole?.id === role.id
											? 'bg-accent font-medium'
											: 'text-muted-foreground hover:bg-accent/50'
									}`}
									onClick={() => loadRoleDetail(role.id)}
								>
									{editingRole === role.id ? (
										<div className="flex-1 space-y-1">
											<Input
												value={editDisplayName}
												onChange={(e) => setEditDisplayName(e.target.value)}
												className="h-7 text-sm"
												onClick={(e) => e.stopPropagation()}
											/>
											<Input
												value={editDescription}
												onChange={(e) => setEditDescription(e.target.value)}
												className="h-7 text-sm"
												placeholder="描述"
												onClick={(e) => e.stopPropagation()}
											/>
											<div className="flex gap-1">
												<Button
													size="icon"
													variant="ghost"
													className="h-6 w-6 hover:bg-green-100"
													onClick={(e) => {
														e.stopPropagation()
														handleUpdateRole(role.id)
													}}
												>
													<Check className="h-3 w-3 text-green-600" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="h-6 w-6 hover:bg-red-100"
													onClick={(e) => {
														e.stopPropagation()
														setEditingRole(null)
													}}
												>
													<X className="h-3 w-3 text-red-500" />
												</Button>
											</div>
										</div>
									) : (
										<>
											<Shield className="h-3.5 w-3.5 shrink-0" />
											<div className="min-w-0 flex-1">
												<div className="truncate">{role.displayName}</div>
												<div className="truncate text-xs text-muted-foreground">
													{role.name}
													{role.isSystem && ' · 系统'}
												</div>
											</div>
											<div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
												<Button
													size="icon"
													variant="ghost"
													className="h-6 w-6"
													onClick={(e) => {
														e.stopPropagation()
														setEditingRole(role.id)
														setEditDisplayName(role.displayName)
														setEditDescription(role.description || '')
													}}
												>
													<Pencil className="h-3 w-3" />
												</Button>
												{!role.isSystem && (
													<Button
														size="icon"
														variant="ghost"
														className="h-6 w-6 hover:bg-red-50"
														onClick={(e) => {
															e.stopPropagation()
															handleDeleteRole(role.id)
														}}
													>
														<Trash2 className="h-3 w-3 text-red-500" />
													</Button>
												)}
											</div>
											<ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
										</>
									)}
								</button>
							))}
						</div>
					</CardContent>
				</Card>

				{/* 右侧：权限编辑 */}
				<Card>
					{selectedRole ? (
						<>
							<CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
								<div>
									<CardTitle className="text-base">
										{selectedRole.displayName}
										<span className="ml-2 text-sm font-normal text-muted-foreground">
											({selectedRole.name})
										</span>
									</CardTitle>
									{selectedRole.description && (
										<p className="mt-1 text-sm text-muted-foreground">{selectedRole.description}</p>
									)}
								</div>
								<Button
									size="sm"
									onClick={handleSavePermissions}
									disabled={saving}
									className="gap-1"
								>
									{saving ? (
										<Loader2 className="h-3 w-3 animate-spin" />
									) : (
										<Check className="h-3 w-3" />
									)}
									保存权限
								</Button>
							</CardHeader>
							<CardContent>
								<div className="space-y-5">
									{PERMISSION_GROUPS.map((group) => {
										const groupPerms = group.permissions
											.map((gp) => allPermissions.find((p) => p.code === gp.code))
											.filter(Boolean) as Permission[]

										if (groupPerms.length === 0) return null

										const allSelected = groupPerms.every((p) => selectedPermIds.has(p.id))

										return (
											<div key={group.module} className="space-y-2">
												<div className="flex items-center gap-2">
													<Checkbox
														checked={allSelected}
														onCheckedChange={() => toggleModulePermissions(group.permissions)}
													/>
													<h3 className="text-sm font-medium">{group.label}</h3>
												</div>
												<div className="ml-6 grid gap-1.5 sm:grid-cols-2">
													{groupPerms.map((perm) => (
														<label
															key={perm.id}
															className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50"
														>
															<Checkbox
																checked={selectedPermIds.has(perm.id)}
																onCheckedChange={() => togglePermission(perm.id)}
															/>
															<span>{perm.name}</span>
															<span className="text-xs text-muted-foreground/60">{perm.code}</span>
														</label>
													))}
												</div>
											</div>
										)
									})}
								</div>
							</CardContent>
						</>
					) : (
						<CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
							<Shield className="mb-3 h-10 w-10 opacity-30" />
							<p className="text-sm">选择左侧角色查看和编辑权限</p>
						</CardContent>
					)}
				</Card>
			</div>
		</AdminLayout>
	)
}
