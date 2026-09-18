# SillyTavern ↔ grok2api：连接与「未连接到 API」

## 两套故障，别混

| 现象 | 真正坏的是 | 处理 |
|------|------------|------|
| ST 底部 **「未连接到 API」**、插头变红、模型列表空、点 Connect 报 **403** | ST **客户端配置**（反向代理 / 代理密码被清空或写错字段） | 重跑 `configure_st_openai.sh` → **Cmd+Shift+R** → Connect |
| ST 显示已连接，但发消息 **502 / 连接上游失败** | grok2api → Grok **SSO 失效** | `bash scripts/refresh_grok_sso.sh`（WebBridge 收 cookie，勿打印 cookie） |
| `start_all` 健康检查都 OK，仍「未连接」 | 只说明进程活着，**不等于** ST 已用对密钥连上 `/v1` | 仍按上表查配置 |

直连自检（不经过 ST）：

```bash
KEY=$(cat ~/Documents/github/grok2api/.client_key)
curl -sS -H "Authorization: Bearer $KEY" http://127.0.0.1:8000/v1/models
curl -sS -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"model":"grok-chat-fast","messages":[{"role":"user","content":"pong"}],"max_tokens":8}' \
  http://127.0.0.1:8000/v1/chat/completions
```

- models **401** → 客户端 key 错  
- chat **502** → SSO / 上游  
- 二者都 **200** 而 UI 仍红 → 纯 ST 配置 / 浏览器缓存会话问题  

## 正确接线（OpenAI Chat Completion + 反向代理）

`scripts/configure_st_openai.sh` 会写入：

| 项 | 值 | UI / DOM |
|----|----|----------|
| Chat Completion Source | OpenAI | — |
| **反向代理** `reverse_proxy` | `http://127.0.0.1:8000/v1` | `#openai_reverse_proxy` |
| **代理密码** `proxy_password` | `.client_key` 全文 | `#openai_proxy_access_key`（文案常叫「代理密码 / Proxy Password」） |
| 模型 | `grok-chat-fast` | — |
| `secrets.json` `api_key_openai` | 同 key（兜底） | 官方 OpenAI Key 框 |

**关键**：只要填了反向代理，ST 发请求时 Bearer 用的是 **`proxy_password`**，不是 OpenAI API Key 框。只填 API Key、反向代理为空时，ST 会打 **官方 api.openai.com** → 本地 `g2a_…` 必 **403**，UI 就「未连接到 API」。

## 坑：浏览器旧标签冲掉磁盘配置

实验室多次出现：

1. 已用脚本写好 `data/default-user/settings.json`（`reverse_proxy` + `proxy_password`）  
2. 用户或自动化 **未硬刷新** 的旧 ST 标签仍在内存里（反向代理为空）  
3. ST 自动/手动保存 → **把空配置写回磁盘** → 再次「未连接」  
4. 外表像「skill 没修好」，其实是 **会话覆盖**

约定：

1. 改配置后：**先 Cmd+Shift+R 硬刷新**，再点 Connect；不要先点保存。  
2. 改完可用脚本再跑一次 `configure_st_openai.sh` 核对磁盘。  
3. 弹出「Connecting To Proxy / 连接代理」确认框时要点确认。  
4. 多标签只留一个 ST；避免一个已连接、一个空配置互相覆盖。  

核对磁盘（勿把 key 打进日志）：

```bash
python3 - <<'PY'
import json
from pathlib import Path
u=Path.home()/"Documents/github/SillyTavern/data/default-user"
o=json.loads((u/"settings.json").read_text())["oai_settings"]
ck=(Path.home()/"Documents/github/grok2api/.client_key").read_text().strip()
print("reverse_proxy=", o.get("reverse_proxy"))
print("proxy_password_ok=", o.get("proxy_password")==ck)
print("openai_model=", o.get("openai_model"))
PY
```

若 `reverse_proxy` 为空或 `proxy_password_ok` 为 False → 立刻重跑 configure，然后硬刷新。

## Agent 操作顺序（用户说「连不上」时）

1. `curl` healthz / ST 首页 — 进程是否活着  
2. 带 key 打 `/v1/models` 与一条 chat — 区分 401 / 502 / 200  
3. 读 `settings.json` 的 `reverse_proxy` / `proxy_password` — 空则 `configure_st_openai.sh`  
4. 告知用户 **硬刷新 + Connect**；需要时用 WebBridge 打开 ST 填 `#openai_reverse_proxy`、`#openai_proxy_access_key` 并点 `#api_button_openai`  
5. 仅当 chat 502 时再 `refresh_grok_sso.sh`  

## 相关脚本

- `scripts/configure_st_openai.sh` — 写 ST 反向代理与代理密码  
- `scripts/refresh_grok_sso.sh` — SSO 复活  
- `scripts/start_all.sh` / `scripts/stop_all.sh` — 启停（stop 含端口兜底）  
