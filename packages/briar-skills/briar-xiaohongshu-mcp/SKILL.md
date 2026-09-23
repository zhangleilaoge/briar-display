---
name: briar-xiaohongshu-mcp
description: 在 macOS 用 xpzouying/xiaohongshu-mcp 发小红书图文笔记。优先从本机 Chrome 导出 cookies（避免反复扫码）；Chromium 运行时 CDN 走一次代理；访问 xhs/创作者后台时直连、不挂代理；用完即停 MCP。触发词：小红书发笔记、xhs-mcp、xiaohongshu-mcp、creator.xiaohongshu、cookies.json。
tags: macos, xiaohongshu, xhs, mcp, cookies, publish
---

# briar-xiaohongshu-mcp — 小红书图文发布

用社区工具 [xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp)（本 skill 按 **v2.5.5** 写）在本机发图文。**不要**用 Grok Bot 去点 Chrome 创作者网页（用户会拒绝 GUI 代操作）；也**不要**把 MCP 常驻后台。

## 路径与端口（实验室默认）

| 项 | 默认 |
|----|------|
| 工具目录 | `$HOME/tools/xiaohongshu-mcp/` |
| 二进制 | `xiaohongshu-mcp-darwin-arm64`（另有 `xiaohongshu-login-darwin-arm64`） |
| Cookie 文件 | `$HOME/tools/xiaohongshu-mcp/cookies.json`（MCP 工作目录相对路径 `./cookies.json`） |
| 内置 Chromium | `$HOME/Library/Caches/xiaohongshu-mcp/browser/<ver>/Chromium.app` |
| HTTP API | `http://127.0.0.1:18060`（`-port=:18060`） |
| 本机 HTTP 代理（仅下载） | `127.0.0.1:7892` |

密钥纪律：`cookies.json` 含 `web_session` 等，**禁止**贴进 chat / commit；对话里只报「已登录 / 昵称」，不回显 cookie 值。

## 网络原则（踩坑总结）

1. **首次拉 Chromium**：官方 CDN（如 `cdn.one-world.ai`）直连常失败。用 `https_proxy=http://127.0.0.1:7892` **手动** `curl` 下 zip/dmg，校验后解压到上述 Caches 路径。内置下载器**不会**自动吃 `XHS_PROXY` 去拉 CDN。
2. **跑 MCP / 访问 xiaohongshu.com / creator**：用**直连**。对国内站挂 `7892` 容易登录态异常或超时。
3. **扫码登录**：headless 多次扫码仍可能 `cookies: []`。实验室优先 **从已登录的 Chrome 导出 cookie**，少骚扰用户扫码。

## 一次安装

```bash
mkdir -p "$HOME/tools/xiaohongshu-mcp" && cd "$HOME/tools/xiaohongshu-mcp"
# 从 GitHub Releases 取 arm64 二进制（版本按需），chmod +x
# 首次缺浏览器时：经 7892 手动下载 Chromium 到 Library/Caches/... 并校验 checksum
```

## Cookie：Chrome → cookies.json（推荐）

前置：本机 **Google Chrome** 已登录小红书网页（`xiaohongshu.com` / 创作者）。导出可能弹 **钥匙串「允许」**——等用户点过再继续。

```bash
# 依赖：pip3 install --user browser-cookie3
python3 scripts/export_chrome_xhs_cookies.py \
  --out "$HOME/tools/xiaohongshu-mcp/cookies.json"
```

成功标志：文件非空、`cookies` 数组含 **`web_session`**（通常还有 `webId` / `xsecappid` 等）。保留 MCP 已有的 `version` / `seed` 字段；只替换 `cookies` 与 `saved_at`。

备选：`xiaohongshu-login-darwin-arm64` 扫码。失败就别死磕，改回 cookie 导出。

## 启动 → 校验 → 发布 → 停止

```bash
cd "$HOME/tools/xiaohongshu-mcp"
# 明确去掉代理环境变量
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
pkill -f xiaohongshu-mcp-darwin-arm64 2>/dev/null || true
nohup ./xiaohongshu-mcp-darwin-arm64 -headless=true -port=:18060 > /tmp/xhs-mcp.log 2>&1 &
echo $! > /tmp/xhs-mcp.pid

# health + login
curl -s --noproxy '*' http://127.0.0.1:18060/health
curl -s --noproxy '*' http://127.0.0.1:18060/api/v1/login/status
# 期望 is_logged_in: true

# 图文：至少 1 张本地图片；tags 会走创作者联想点击
curl -s --noproxy '*' -m 150 -X POST http://127.0.0.1:18060/api/v1/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "标题（注意长度限制）",
    "content": "正文",
    "images": ["/absolute/path/cover.png"],
    "tags": ["标签1", "标签2"]
  }'
# 成功：HTTP 200 且 message 含「发布成功」；日志里常见跳到
# https://creator.xiaohongshu.com/publish/success?...

# 用完必停
kill "$(cat /tmp/xhs-mcp.pid)" 2>/dev/null || pkill -f xiaohongshu-mcp-darwin-arm64
```

或一键：`bash scripts/publish_note.sh`（读环境变量，见脚本头注释）。

## 失败对照

| 现象 | 处理 |
|------|------|
| CDN / Chromium 下不动 | 经 `7892` 手动下到 Caches；不要指望 MCP 自带下载走代理 |
| 扫码后仍未登录 / `cookies: []` | 改 Chrome 导出；临时停用对 xhs 的系统代理 |
| `login/status` 已登录但 publish 502 / 进程没了 | 重启 MCP，用 `curl --noproxy '*'`；Python `urllib` 若吃到全局代理会打到错误网关 |
| 用户说「别啊」拒浏览器代操作 | **立刻停** computerUse / 点 Chrome；改 cookie + MCP API |
| 标签点不上 | 标签名改成创作者联想里真实存在的词；少而准 |

## 与用户偏好对齐

- MCP **用完即杀**，不常驻、不设开机自启。
- 发帖内容与封面由用户给定；助手只负责接线与调用。
- 技能落点：本仓库 `packages/briar-skills/briar-xiaohongshu-mcp/`（不是云电脑）。
