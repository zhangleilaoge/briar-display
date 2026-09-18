# WebBridge / CDP — 采集 grok.com SSO

## 目标

从**已登录** <https://grok.com> 的浏览器上下文读取 cookie：

- `sso`
- `sso-rw`

交给 grok2api Admin 导入，而**不要**把 cookie 值粘贴进 Agent 聊天。

## 前置

- Kimi WebBridge（或等价 CDP 代理）在 macOS 监听  
  默认探测：`BRIAR_WEBBRIDGE_CDP` = `http://127.0.0.1:10086`
- 用户已在该浏览器配置里登录 grok.com

## 推荐流程

1. 确认 CDP 可达：`curl -sS "$BRIAR_WEBBRIDGE_CDP/json/version"`（或 WebBridge 自身健康检查）
2. 列出 targets / 选中 grok.com 页面
3. 通过 CDP `Network.getCookies` 或等价 API 过滤 `domain` 含 `grok.com`、name ∈ `{sso,sso-rw}`
4. 写入临时文件，权限 **0600**，例如：  
   `$HOME/.config/briar-skills/grok-sso.env`  
   格式示例（占位）：
   ```
   SSO=replace_me
   SSO_RW=replace_me
   ```
5. 调用 `scripts/import_grok_sso.sh`：读取该文件 → 调 grok2api Admin import → 确认 active
6. 导入成功后可删除临时 env，或保留但永不 git add

## 禁止

- 在 SKILL / PR / issue / chat 中粘贴真实 SSO
- 用截图 OCR 把完整 cookie 回传给模型（除非用户明确要求且仍写入 0600 文件）
- 把 cookie 文件放到仓库目录内

## 故障

| 症状 | 处理 |
|------|------|
| 连接 CDP refused | 检查 WebBridge 是否启动、端口是否仍为 10086 |
| 有页面但无 sso cookie | 用户重新打开 grok.com 并登录；注意 HttpOnly/Secure 仍可通过 CDP 读取 |
| 导入后很快失效 | SSO 会话过期 → 重新采集 |

## 与脚本的关系

`scripts/import_grok_sso.py` 封装：探测 CDP → 写 0600 文件 → HTTP 调用本地 grok2api Admin（具体 Admin 路径以 grok2api 当前版本为准；脚本内用占位并打印清晰错误）。
