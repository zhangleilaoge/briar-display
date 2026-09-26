# SSH 控制台

页面 `/briar/admin/terminal`（AdminLayout 侧边栏「SSH 控制台」）。

## 相关文件

| 文件 | 作用 |
| :--- | :--- |
| `packages/briar-node/src/routes/terminalWs.ts` | WebSocket 桥接（`/api/terminal/ws`，挂 http server upgrade，cookie/token 鉴权 + `admin:terminal:access` 权限 + 设备令牌）：ssh2 连 `DEPLOY_HOST`，`DEPLOY_KEY_PATH` 私钥优先、否则 `DEPLOY_PASS`；命令行审计落 `terminal_audit_logs` |
| `packages/briar-node/src/routes/terminal.ts` | HTTP API（`/api/terminal`）：发设备验证码、验码签 7 天设备令牌、服务器信息采集（host-info） |
| `packages/briar-node/src/services/terminalService.ts` | 验证码/设备令牌签发校验、ssh2 采集服务器信息（10s 缓存）、`resolveDeployKeyPath` |

## 要点

- 前端 xterm.js **必须动态 import**，静态导入 CJS 包会让 Astro build 失败；多标签会话（每个 tab 独立 WS + SSH 连接，切换仅隐藏容器保持存活）
- WS 端点 `/api/terminal/ws`，nginx 需转发 Upgrade 头（`default.conf` 已配，改动后手动 `./scripts/deploy-nginx.sh`）
- SSH 目标复用 `DEPLOY_*` 环境变量；**`.env` 需配 `DEPLOY_KEY_PATH`**（指向私钥，相对路径基于仓库根目录解析，如 `briar-assets/ssh/xiaobuzi.pem`，本地/服务器同值通用；`briar-assets/briar/.env` 已配，`make init` 会带出来），否则回退 `DEPLOY_PASS` 密码（当前服务器密码已失效，仅密钥可用）
- 权限 `admin:terminal:access`（admin 角色已授权），所有会话的命令行输入落 `terminal_audit_logs` 审计表
- **设备授权**：使用前需邮箱验证码验证（复用通用验证码邮件模板），验码通过签发 7 天设备令牌（JWT，purpose=`terminal-device`，存前端 localStorage `briar_terminal_device`）；WS 连接与 `/api/terminal/host-info` 均强校验设备令牌
- 页面顶部服务器信息面板（`/api/terminal/host-info`，ssh2 采集系统/CPU 负载/内存/硬盘，10s 缓存，前端 15s 轮询）
