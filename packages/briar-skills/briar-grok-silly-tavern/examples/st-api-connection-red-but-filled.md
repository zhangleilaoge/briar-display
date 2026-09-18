# Example：配置都填了，顶部插头仍红 / 「未连接到 API」

## 现象（真实截图结论）

API 连接配置已选 `grok2api-local`，且：

- 聊天补全来源 = OpenAI  
- 代理预设 / 名称 = `grok2api-local`  
- 代理服务器 URL = `http://127.0.0.1:8000/v1`  
- 代理密码 = 已填（圆点）  

但底部仍显示 **未连接到 API!**，顶栏插头仍红。

## 原因

**填表 ≠ 已连接。**  
SillyTavern 只有点击 **`#api_button_openai`（Connect / 连接）** 并成功跑完 `getStatusOpen()` 后，才会把 `online_status` 从 `no_connection` 改成模型名。

选中 Connection Profile 只会写入 api / proxy / model 等字段；**不会自动点 Connect**（除非勾了 Auto-connect）。

中间那段红色「使用代理有风险…」是**警告文案**，不是报错；点连接后若弹出确认框，需要点确认。

## 先排除上游（终端，可选）

```bash
curl -sS http://127.0.0.1:8000/healthz
KEY=$(cat ~/Documents/github/grok2api/.client_key)
curl -sS -H "Authorization: Bearer $KEY" http://127.0.0.1:8000/v1/models | head -c 200
```

二者正常则问题在 ST 未点连接，不是 grok2api。

## 用户手动步骤（推荐）

1. 只留一个 `http://127.0.0.1:8001` 标签。  
2. API 连接配置选 **`grok2api-local`**。  
3. **向下滚动**到 OpenAI 区块的 **Connect / 连接** 按钮并点击。  
4. 若弹出 Connecting To Proxy / 代理确认 → 确认。  
5. 成功后：`online_status` 旁应变绿，文案变为模型名（如 `grok-chat-fast`），底部「未连接到 API」消失。

可选：勾选 **Auto-connect to Last Server**，下次启动自动连。

## Agent 磁盘侧（禁止为调试而 WebBridge navigate 新开标签）

只改磁盘，让用户自己硬刷新 + 点连接：

1. `settings.json` → `proxies[]` 增加 `{name,url,password}`，`selected_proxy` 指向它。  
2. `oai_settings.reverse_proxy` / `proxy_password` / `chat_completion_source=openai` / `openai_model`。  
3. `extension_settings.connectionManager.profiles` 增加 profile（`mode=cc`, `api=openai`, `proxy=<预设名>`, `model=...`），`selectedProfile=<id>`。  
4. 同步 `OpenAI Settings/*.json`。  
5. 告诉用户：**Cmd+Shift+R → 选配置 → 点 Connect**。  

**不要**用 WebBridge `navigate` 打开新的 ST 标签：新标签常带着空 `reverse_proxy`，自动保存会再次冲掉磁盘配置。

## 对照

| 状态 | 含义 |
|------|------|
| 表单已填 + 仍红 | 还没 Connect，或 Connect 弹窗没确认 |
| Connect 后仍红 + `/v1/models` 401 | 代理密码不对 |
| Connect 后绿，发消息 502 | SSO，跑 `refresh_grok_sso.sh` |
