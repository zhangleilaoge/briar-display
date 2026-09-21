# Example：Chat Completion API「模型不存在」

## 现象

ST toast：`Chat Completion API` / **模型不存在**。代理 URL、代理密码、连接配置都可以看起来是对的。

## 原因

请求里的 `model` 不在 grok2api `/v1/models` 中。

本实验室复现：磁盘 `oai_settings.openai_model` 变成了 **`gpt-5.6-terra`**（或其它 gpt-*），而 grok2api 只有例如：

- `grok-chat-fast`（推荐）
- `grok-chat-auto`
- `grok-chat-expert`

用 `gpt-4o` / `gpt-5.6-terra` 会 404「模型不存在」。

Connection Profile / Default 预设里即便写着 `grok-chat-fast`，只要当前 `settings.json` 的 `openai_model` 被改掉，发消息仍会用错模型。

## 判别

```bash
KEY=$(cat ~/Documents/github/grok2api/.client_key)
curl -sS -H "Authorization: Bearer $KEY" http://127.0.0.1:8904/v1/models
python3 - <<'PY'
import json
from pathlib import Path
o=json.loads((Path.home()/"Documents/github/SillyTavern/data/default-user/settings.json").read_text())["oai_settings"]
print(o.get("openai_model"))
PY
```

## 修复

1. 把 `openai_model`、Connection Profile 的 `model`、`OpenAI Settings/*.json` 全部改成 **`grok-chat-fast`**。  
2. ST 硬刷新；模型框确认是 `grok-chat-fast` 后再发。  
3. 或跑 `scripts/configure_st_openai.sh`（必须写入 `openai_model=grok-chat-fast`）。
