# 已知陷阱

只记录当前实现仍存在、容易误踩且其他文档未完整覆盖的问题；普通用法、失效场景和单纯事故经过不留。新陷阱追加到末尾，删除后重排编号并更新引用。

## 1. ssh2 / cpu-features 的原生绑定会让进程 core dump

ssh2 的两个可选原生依赖（`sshcrypto.node`、`cpufeatures.node`）在 `bun install` 时编译，但**加载即崩溃**（bun 报 `unsupported uv function: uv_version_string`，node 直接 segfault），表现为部署后 briar-node 崩溃循环、502。

修复：`scripts/remove-ssh2-native.mjs` 删除这两个 build 目录（ssh2 有纯 JS 降级）。已挂三处：根 `package.json` postinstall、`Makefile init`、`scripts/deploy.sh`（bun install 之后）。**bun 不会可靠执行根 package.json 的 postinstall**，所以 deploy.sh 里必须显式调用。

## 2. 页面权限门控必须同时处理 Provider 层级和三态

`usePermissions` 在 Provider 外会返回兜底 context（`loading:false` + `isAdmin:false` + 空权限），导致 `useRequirePermission` 直接 denied，管理员也提示无权限。`AdminLayout` 内部的 Provider 只包其返回内容，覆盖不到页面此前的权限判断。

正确结构参照 `AdminUsersPage`：页面外层包 `PermissionProvider`，Inner 再调用 hook；渲染时分别处理 `loading` 和 `denied`，不要把加载中的空权限当作无权限。

## 3. 主仓库提交别误带回退的 briar-assets 子模块引用

续期任务会更新证书及主仓库 gitlink；本地子模块停在旧 ref 时，`git add -A` / `git commit -a` 可能误提交旧引用，导致证书回退或分支冲突。部署脚本只能快进落后的线性 gitlink，不能替代提交前检查。

提交前检查 `git status`，确认 briar-assets 的变更确实是预期的新 ref；需要同步时先 `git submodule update`，不要盲带子模块变更。

## 4. COS 带 Query 的签名 URL 必须二次编码 q-url-param-list

cos-nodejs-sdk-v5 的同步签名路径漏了 `q-url-param-list` 二次编码，数据万象参数（如 `imageMogr2/...`）因此可能报 403 `SignatureDoesNotMatch`。

当前 `cosService.getSignedUrl` 使用 `COS.getAuthorization` 自行组 URL，并显式修正这段编码；修改该路径不能删掉 workaround。对签名 URL 发 `Range: bytes=0-0` 请求，返回 206 才算验证通过。

## 5. 小红书风控会综合 TLS/HTTP 指纹与 IP，不能用裸 fetch 硬刷

笔记页被拦时会跳到 `/404/sec_...` 安全页，或桌面端返回空 `noteDetailMap`。同 IP 高频请求及不同 TLS 指纹都会影响结果，不能把空数据当作笔记不存在。

应对保持与 `xhsMediaService` 一致：只带 UA 和 Cookie 的极简请求头、每次重试换 fresh `a1`、有限次数递增等待后再走桌面兜底。额外堆浏览器请求头或无限重试反而更容易触发风控。

## 6. MySQL session 与 Node 进程时区必须一起确认

`request_logs.created_at` 是 `TIMESTAMP`，不是“固定存北京时间”。MySQL 会按 session 时区转换时间，mysql2 又按 Node 进程时区解析；当前配置没有统一设置 session `time_zone`、mysql2 `timezone` 或 `dateStrings`。

`toISOString()` 输出 UTC 的 `Z` 是正常表示，不是时间少了 8 小时。写 SQL 时间窗、管理端日期筛选或缓存 TTL 时，先确认两端时区并显式转换，不要拿本机时间直接推断线上结果。

## 7. 本地 preview 要分别配对 CDN 资源和 API 地址，否则会出现假水合故障

`astro.config.mjs` 的 `assetsPrefix` 读取根 `.env` 的 `BRIAR_TX_BUCKET_DOMAIN`：普通本地构建会把 JS/CSS chunk 的 URL 写成 CDN 域名，而 CDN 上只有上一次 CI 上传的旧产物——新页面 / 新 chunk 在 CDN 404，表现为白屏、输入框能改但组件未水合或点击无反应。

统一用 `BUILD_DEV=true` 关闭本地构建的 CDN 前缀，不必修改 `.env`：

```bash
bun run --filter @briar/shared build
BUILD_DEV=true bun run --filter @briar/display build
bun run --filter @briar/display preview --host 127.0.0.1 --port 43988
```

**`BUILD_DEV=true` 只处理静态资源，不处理 API 地址。** `src/api/request.ts` 会让本地页面默认请求 3888；从 43988 打开 preview 时，如果自建 API 不在 3888，就换高端口并在构建时显式指定，例如：

```bash
PORT=43888 NODE_ENV=development BRIAR_ENABLE_SCHEDULER=0 bun run --filter @briar/node start
BUILD_DEV=true PUBLIC_API_BASE_URL=http://127.0.0.1:43888/api bun run --filter @briar/display build
```

`PUBLIC_API_BASE_URL` 在构建时内嵌，改端口后必须重新构建前端，只重启 preview 无效。3888 空闲且使用当前产物时，优先通过同源 `http://127.0.0.1:3888/briar/...` 验收真实 API，少一套跨端口配置。不要为了验收杀不明确的占用进程。

遇到不水合先看 console 和实际脚本 / API 请求：脚本仍指向 CDN，是资源构建问题；API 请求 3888 但服务在高端口，是 API 配置问题。两者都不是产品交互 bug，不要靠刷新、重复点击或改产品代码掩盖。验收后恢复标准生产构建；CI / 部署不受影响（流水线先上传 CDN 再部署）。

## 8. 抖音 `Uifid Not Found` 不等于只缺 uifid 参数

旧 a_bogus 签名栈失效时也可能报 `403 Blocked by ArgusSecurityPlugin Uifid Not Found`，不能只补参数。当前 detail 接口需要 a_bogus、`x-secsdk-web-signature` 和真实浏览器签发的 `UIFID_TEMP` / `UIFID` cookie（配置 `BRIAR_DOUYIN_COOKIE`）共同通过校验。

修改签名时先对照当前上游参考实现。`aBogus.test.ts` 的 golden 必须用 Python 参考实现重新生成，不能拿旧输出改期望值。

## 9. Vite 懒加载路由必须进入启动依赖扫描

只在首次导航时才遇到的依赖会触发新一轮预构建；页面仍持有的旧 `?v=` 依赖 URL 随后返回 `504 (Outdated Optimize Dep)`，连带动态 import 失败、React 卸载和整页白屏。清缓存或反复刷新不能防止下一个懒加载依赖再次触发。

`astro.config.mjs` 的 `optimizeDeps.entries` 已指向集中登记路由的 `src/components/common/SiteApp.tsx`，扫描会跟随路由及文件预览等下游动态 import。新增绕过该入口的懒加载页面时，要把它纳入 entries；不要加自动刷新循环，也不要把白屏当作业务组件错误来改。
