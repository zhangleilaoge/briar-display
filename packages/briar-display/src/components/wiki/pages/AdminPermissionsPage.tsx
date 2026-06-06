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
import { Input } from '@/components/ui/input'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import { usePermissions } from '@/contexts/PermissionContext'
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

export default function AdminPermissionsPage() {
	const { hasPermission, isAdmin } = usePermissions()
	const [roles, setRoles] = useState<Role[]>([])
	const [allPermissions, setAllPermissions] = useState<Permission[]>([])
	const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// 新建角色表单
	const [showCreateForm, setShowCreateForm] = useState(false)
	const [newRoleName, setNewRoleName] = useState('')
	const [newRoleDisplayName, setNewRoleDisplayName] = useState('')
	const [newRoleDescription, setNewRoleDescription] = useState('')

	// 编辑角色
	const [editingRole, setEditingRole] = useState<string | null>(null)
	const [editDisplayName, setEditDisplayName] = useState('')
	const [editDescription, setEditDescription] = useState('')

	// 当前选中角色的权限编辑
	const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set())

	const canManageRoles = hasPermission('admin:role:manage') || isAdmin

	const fetchData = useCallback(async () => {
		try {
			setLoading(true)
			const [rolesRes, permsRes] = await Promise.all([getRoles(), getPermissions()])
			if (rolesRes.success) setRoles(rolesRes.data || [])
			if (permsRes.success) setAllPermissions(permsRes.data || [])
		} catch (err) {
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

	if (!canManageRoles) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: '管理后台' }, { label: '权限管理' }]} />
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
			<WikiBreadcrumbs items={[{ label: '管理后台' }, { label: '权限管理' }]} />

			<div className="flex items-center gap-3">
				<Shield className="h-6 w-6 text-wiki-link" />
				<h1 className="text-xl font-semibold text-wiki-text">角色与权限管理</h1>
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

			<div className="grid gap-6 lg:grid-cols-[300px_1fr]">
				{/* 左侧：角色列表 */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-medium text-wiki-text">角色列表</h2>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setShowCreateForm(true)}
							className="h-7 gap-1 text-xs"
						>
							<Plus className="h-3 w-3" />
							新建
						</Button>
					</div>

					{showCreateForm && (
						<div className="space-y-2 rounded border border-wiki-border-light bg-wiki-bg-secondary p-3">
							<Input
								placeholder="角色标识（英文）"
								value={newRoleName}
								onChange={(e) => setNewRoleName(e.target.value)}
								className="h-8 text-[13px]"
							/>
							<Input
								placeholder="显示名称"
								value={newRoleDisplayName}
								onChange={(e) => setNewRoleDisplayName(e.target.value)}
								className="h-8 text-[13px]"
							/>
							<Input
								placeholder="描述（可选）"
								value={newRoleDescription}
								onChange={(e) => setNewRoleDescription(e.target.value)}
								className="h-8 text-[13px]"
							/>
							<div className="flex gap-2">
								<Button
									size="sm"
									onClick={handleCreateRole}
									disabled={saving}
									className="h-7 text-xs"
								>
									创建
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setShowCreateForm(false)}
									className="h-7 text-xs"
								>
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
								className={`group flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-[13px] transition-colors ${
									selectedRole?.id === role.id
										? 'bg-wiki-bg-tertiary font-medium text-wiki-text'
										: 'text-wiki-text-secondary hover:bg-wiki-bg-tertiary'
								}`}
								onClick={() => loadRoleDetail(role.id)}
							>
								{editingRole === role.id ? (
									<div className="flex-1 space-y-1">
										<Input
											value={editDisplayName}
											onChange={(e) => setEditDisplayName(e.target.value)}
											className="h-7 text-[13px]"
											onClick={(e) => e.stopPropagation()}
										/>
										<Input
											value={editDescription}
											onChange={(e) => setEditDescription(e.target.value)}
											className="h-7 text-[13px]"
											placeholder="描述"
											onClick={(e) => e.stopPropagation()}
										/>
										<div className="flex gap-1">
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation()
													handleUpdateRole(role.id)
												}}
												className="rounded p-1 hover:bg-green-100"
											>
												<Check className="h-3 w-3 text-green-600" />
											</button>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation()
													setEditingRole(null)
												}}
												className="rounded p-1 hover:bg-red-100"
											>
												<X className="h-3 w-3 text-red-500" />
											</button>
										</div>
									</div>
								) : (
									<>
										<Shield className="h-3.5 w-3.5 shrink-0" />
										<div className="min-w-0 flex-1">
											<div className="truncate">{role.displayName}</div>
											<div className="truncate text-[11px] text-wiki-text-muted">
												{role.name}
												{role.isSystem && ' · 系统'}
											</div>
										</div>
										<div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation()
													setEditingRole(role.id)
													setEditDisplayName(role.displayName)
													setEditDescription(role.description || '')
												}}
												className="rounded p-1 hover:bg-wiki-bg-secondary"
											>
												<Pencil className="h-3 w-3" />
											</button>
											{!role.isSystem && (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation()
														handleDeleteRole(role.id)
													}}
													className="rounded p-1 hover:bg-red-50"
												>
													<Trash2 className="h-3 w-3 text-red-500" />
												</button>
											)}
										</div>
										<ChevronRight className="h-3.5 w-3.5 shrink-0 text-wiki-text-muted" />
									</>
								)}
							</button>
						))}
					</div>
				</div>

				{/* 右侧：权限编辑 */}
				<div>
					{selectedRole ? (
						<div className="space-y-4">
							<div className="flex items-center justify-between border-b border-wiki-border-light pb-3">
								<div>
									<h2 className="text-base font-medium text-wiki-text">
										{selectedRole.displayName}
										<span className="ml-2 text-sm text-wiki-text-muted">({selectedRole.name})</span>
									</h2>
									{selectedRole.description && (
										<p className="mt-1 text-[13px] text-wiki-text-secondary">
											{selectedRole.description}
										</p>
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
							</div>

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
												<button
													type="button"
													onClick={() => toggleModulePermissions(group.permissions)}
													className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
														allSelected
															? 'border-wiki-link bg-wiki-link text-white'
															: 'border-wiki-border bg-wiki-bg'
													}`}
												>
													{allSelected && <Check className="h-3 w-3" />}
												</button>
												<h3 className="text-[13px] font-medium text-wiki-text">{group.label}</h3>
											</div>
											<div className="ml-6 grid gap-1.5 sm:grid-cols-2">
												{groupPerms.map((perm) => (
													<label
														key={perm.id}
														className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-wiki-text-secondary hover:bg-wiki-bg-secondary"
													>
														<input
															type="checkbox"
															checked={selectedPermIds.has(perm.id)}
															onChange={() => togglePermission(perm.id)}
															className="h-3.5 w-3.5 rounded border-wiki-border"
														/>
														<span>{perm.name}</span>
														<span className="text-[11px] text-wiki-text-muted">{perm.code}</span>
													</label>
												))}
											</div>
										</div>
									)
								})}
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-20 text-wiki-text-muted">
							<Shield className="mb-3 h-10 w-10 opacity-30" />
							<p className="text-sm">选择左侧角色查看和编辑权限</p>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
