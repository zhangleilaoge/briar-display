# 已知陷阱

从 `AGENTS.md` 拆出的踩坑记录，新陷阱追加到末尾并递增编号。

## 1. 前端 API baseURL 不要加 `/briar`

生产环境请求 `https://xiaobuzi.cn/api/*`（Nginx 代理），`request.ts` 自动计算 baseURL，无需手动拼。

## 2. 环境变量在项目根目录

后端加载 `.env` 的路径是 `../../../../.env`（项目根目录），不是 `packages/briar-node/` 下。

## 3. 权限检查必须区分三态

**错误**：loading 期间 `hasPermission` 返回 false，闪现"无权限"。

**正确**：使用 `useRequirePermission` hook：

```tsx
const { loading, authorized, denied } = useRequirePermission('admin:xxx')
if (loading) return <Spinner />
if (denied) return <NoPermission />
return <Content />
```

## 4. ssh2 / cpu-features 的原生绑定会让进程 core dump

ssh2 的两个可选原生依赖（`sshcrypto.node`、`cpufeatures.node`）在 `bun install` 时编译，但**加载即崩溃**（bun 报 `unsupported uv function: uv_version_string`，node 直接 segfault），表现为部署后 briar-node 崩溃循环、502。

修复：`scripts/remove-ssh2-native.mjs` 删除这两个 build 目录（ssh2 有纯 JS 降级，性能差异可忽略）。已挂三处：根 `package.json` postinstall、`Makefile init`、`Dockerfile`（bun install 之后用 bun 补跑）。**注意 bun 不会可靠执行根 package.json 的 postinstall**，所以必须显式调用。

## 5. 页面组件用 `useRequirePermission` 必须自己包 `PermissionProvider`

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

## 6. 主仓库提交别把 briar-assets 子模块引用回退

续期任务会把新证书提交到 briar-assets 并更新主仓库的子模块引用；但如果本地 briar-assets 检出停在旧 ref，`git add -A` / `git commit -a` 会把旧引用一起提交。下次部署 `git submodule update` 会把服务器子模块检出回旧 ref → **证书文件被删除** → 次日凌晨任务判定"证书不存在"重复申请（LE 同域名每周限 5 张）。

预防：推送主仓库前 `git submodule update` 保持本地子模块与远端一致；提交前检查 `git status` 里 briar-assets 的变更是否是预期的新 ref。

## 7. cos-nodejs-sdk-v5 的 `getObjectUrl` 同步返回值带 Query 时签名无效

静态密钥下 `getObjectUrl({ Sign: true, Query: {...} })` 同步返回字符串，但 SDK 只在异步回调路径里对 `q-url-param-list` 做二次编码（`replaceUrlParamList`），同步路径漏了——带数据万象参数（如 `imageMogr2/...`）的签名 URL 直接 403 `SignatureDoesNotMatch`，不带 Query 的则正常。

修复：拿到同步返回的 URL 后手动套用同款二次编码（见 `cosService.getSignedUrl`）。验证方式：对签名 URL 发 `Range: bytes=0-0` 请求，206 为有效。

## 8. Docker 镜像必须带完整 node_modules 和 src TS 源码

Bree 定时任务的 `.mjs` job 不显式打包——它们在运行时用 `tsx/esm/api` 的 `tsImport` 动态加载 `src/services/*.ts`、`src/dal/*.ts`（见 `src/jobs/*.mjs` 的 candidates 逻辑）。所以镜像只拷 `dist/` 会让所有定时任务起不来；`Dockerfile` 必须连同 `packages/briar-node/src`、完整 `node_modules`（含 devDep `tsx`）一起拷。bun 隔离布局下 `packages/*/node_modules` 里全是指向根 `node_modules/.bun` store 的相对符号链接，保持 repo 目录布局原样拷贝链接才有效。

同理 jobs 的 `findRepoRoot` 靠 `bun.lock` 定位仓库根，镜像根必须放 `bun.lock`，`.env` 挂载到 `/app/.env`。

## 9. 国内服务器拉不动 docker.io：镜像加速器 + 去掉 syntax 指令

服务器直连 `registry-1.docker.io` 超时。已配 `/etc/docker/daemon.json` 的 `registry-mirrors: ["https://mirror.ccs.tencentyun.com"]`（腾讯 CVM 内网免费）。另外 `Dockerfile` 不能写 `# syntax=docker/dockerfile:1`——它会让 BuildKit 额外从 docker.io 拉 `docker/dockerfile:1` 前端镜像，绕过 mirror 配置直接超时；Docker 28 的内置前端足够用。

镜像仓库用腾讯云 CCR（`ccr.ccs.tencentyun.com`），服务器拉取走内网（RTT 0.15ms）。**服务器内存仅 3.6G，绝不能在服务器上 `docker build`**（vite 打包峰值超 2G，曾把整机打到 swap 颠簸失联），构建只走 CI。

## 10. 容器内关闭证书自动续期，宿主机 cron 兜底

`renew-certificates` 任务不止签发证书：它还要 git commit/push briar-assets 子模块、更新主仓库 submodule 引用并 push、跑 `scripts/deploy-nginx.sh`（sudo + 宿主机 nginx）。容器里没有 git 身份、`.git`、sudo，这套全不可用。因此 compose 给 app 设了 `BRIAR_CERT_RENEWAL=off`（`schedulerConfig.ts` 读它禁用任务），宿主机 crontab 兜底：

```
17 3 * * * cd /home/ubuntu/github/briar-display && node packages/briar-node/node_modules/.bin/tsx packages/briar-node/src/jobs/renew-certificates.mjs
```

注意宿主机 `node_modules` 靠旧的 PM2 部署时代遗留，`deploy-docker.sh` 不再 `bun install`；若宿主机重装环境需补一次 `bun install` 才能跑这条 cron。

## 11. compose 的 environment 与挂载 .env 的优先级

app 容器同时挂了 `/app/.env`（dotenv 读文件）和 compose `environment`（直接注入进程环境）。dotenv **不覆盖**已存在的环境变量，所以 `BRIAR_DATABASE_HOST=mysql` 这类容器网络内的覆盖放在 compose `environment` 里才生效；只改 `.env` 会被覆盖挡住。同理 jobs 从 `/app/.env` 读到的数据库地址也会被 `environment` 修正。
