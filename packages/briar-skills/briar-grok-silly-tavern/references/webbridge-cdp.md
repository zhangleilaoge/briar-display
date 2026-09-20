# WebBridge / CDP — grok.com SSO

## 真实接口（2026-09-18 验证）

Kimi WebBridge daemon：`http://127.0.0.1:10086`

| 用途 | 调用 |
|------|------|
| 健康 | `GET /status` |
| 命令 | `POST /command` JSON：`{action, args, session}` |
| 借当前标签 | `find_tab` + `{"url":"https://grok.com","active":true}` |
| 读 cookie | `cdp` + `Network.getCookies` `urls:["https://grok.com"]` |

**不是** Chrome 远程调试口：`/json/version`、`/json/list` 在 10086 上通常 404。CDP 只走 `action:"cdp"`。

CLI：`~/.kimi-webbridge/bin/kimi-webbridge start|status`

## 快修（代理 / SSO 失效）

症状：ST/curl 对 `grok-chat-fast` 返回 **401**、空账号池、或 **503 账号池不支持**。

```bash
# 1) 浏览器里打开 grok.com 并保持登录（WebBridge 能借到该标签）
# 2) 一键重拉 SSO + 导入 + smoke
bash scripts/refresh_grok_sso.sh
```

脚本会：启动 WebBridge（若有 CLI）→ `find_tab` grok.com → CDP 取 `sso`/`sso-rw`（只日志 name）→ 写入 `~/.config/briar-skills/grok-sso.env` (0600) → Admin `web/import` → `/v1/chat/completions` smoke。

## 禁止

- 把 cookie 值贴进 chat / commit / SKILL
- OCR 截图里的完整 SSO 回传模型
