# 已知陷阱

从 `AGENTS.md` 拆出的踩坑记录，新陷阱追加到末尾并递增编号。

## 1. Hono 的 `basePath()` 是 immutable 的

```ts
// ❌ 返回值被忽略
app.basePath('/briar-display')
// ✅ 链式调用
const app = new Hono().basePath('/briar-display')
```

当前项目已通过 nginx 处理路径前缀，后端无需 basePath。

## 2. 前端 API baseURL 不要加 `/briar-display`

生产环境请求 `https://xiaobuzi.cn/api/*`（Nginx 代理），`request.ts` 自动计算 baseURL，无需手动拼。

## 3. 环境变量在项目根目录

后端加载 `.env` 的路径是 `../../../../.env`（项目根目录），不是 `packages/briar-node/` 下。

## 4. 数据库初始化

`make db-setup` 执行 `packages/briar-node/src/db/setup.ts`，数据库名 `briar_display`。

## 5. 权限检查必须区分三态

**错误**：loading 期间 `hasPermission` 返回 false，闪现"无权限"。

**正确**：使用 `useRequirePermission` hook：

```tsx
const { loading, authorized, denied } = useRequirePermission('admin:xxx')
if (loading) return <Spinner />
if (denied) return <NoPermission />
return <Content />
```

## 6. ssh2 / cpu-features 的原生绑定会让进程 core dump

ssh2 的两个可选原生依赖（`sshcrypto.node`、`cpufeatures.node`）在 `bun install` 时编译，但**加载即崩溃**（bun 报 `unsupported uv function: uv_version_string`，node 直接 segfault），表现为部署后 briar-node 崩溃循环、502。

修复：`scripts/remove-ssh2-native.mjs` 删除这两个 build 目录（ssh2 有纯 JS 降级，性能差异可忽略）。已挂三处：根 `package.json` postinstall、`Makefile init`、`scripts/deploy.sh`（bun install 之后）。**注意 bun 不会可靠执行根 package.json 的 postinstall**，所以 deploy.sh 里必须显式调用。

## 7. 页面组件用 `useRequirePermission` 必须自己包 `PermissionProvider`

`usePermissions` 在 provider 外会返回兜底 context（`loading:false` + `isAdmin:false` + 空权限），`useRequirePermission` 不会 loading、直接 denied——表现为管理员也提示「你没有权限访问此页面」。

注意 `AdminLayout` 内部的 `PermissionProvider` 帮不上忙：页面的权限判断发生在 `AdminLayout` 返回之前。正确姿势是页面组件自己包（对照 `AdminUsersPage`）：

```tsx
export default function AdminXxxPage() {
	return (
		<PermissionProvider>
			<AdminXxxPageInner />
		</PermissionProvider>
	)
}
```
