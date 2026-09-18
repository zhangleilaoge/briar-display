#!/usr/bin/env bash
# Point SillyTavern Chat Completion at local grok2api.
# With reverse_proxy set, SillyTavern uses proxy_password as Bearer (not api_key_openai).
set -euo pipefail
ST_USER="${ST_USER_DIR:-$HOME/Documents/github/SillyTavern/data/default-user}"
G2A_HOME="${GROK2API_HOME:-$HOME/Documents/github/grok2api}"
KEY_FILE="${G2A_CLIENT_KEY_FILE:-$G2A_HOME/.client_key}"
PROXY_URL="${G2A_PROXY_URL:-http://127.0.0.1:8000/v1}"
MODEL="${G2A_MODEL:-grok-chat-fast}"
[[ -f "$KEY_FILE" ]] || { echo "missing $KEY_FILE" >&2; exit 1; }
[[ -f "$ST_USER/settings.json" ]] || { echo "missing settings.json — start SillyTavern once first" >&2; exit 1; }
KEY=$(cat "$KEY_FILE")
python3 - "$ST_USER" "$KEY" "$PROXY_URL" "$MODEL" <<'PY'
import json, sys, uuid
from pathlib import Path
user, key, proxy, model = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
s = json.loads((user/"settings.json").read_text())
s["main_api"] = "openai"
o = s.setdefault("oai_settings", {})
o["chat_completion_source"] = "openai"
o["reverse_proxy"] = proxy
o["proxy_password"] = key
o["openai_model"] = model
o["show_external_models"] = True
(user/"settings.json").write_text(json.dumps(s, indent=4, ensure_ascii=False))
sec_path = user/"secrets.json"
sec = json.loads(sec_path.read_text()) if sec_path.exists() else {}
sec["api_key_openai"] = [{"id": str(uuid.uuid4()), "value": key, "label": "grok2api-local", "active": True}]
sec_path.write_text(json.dumps(sec, indent=4)); sec_path.chmod(0o600)
preset = user/"OpenAI Settings"/"Default.json"
if preset.exists():
    d = json.loads(preset.read_text())
    d.update({"chat_completion_source":"openai","reverse_proxy":proxy,"proxy_password":key,"openai_model":model})
    preset.write_text(json.dumps(d, indent=4, ensure_ascii=False))
print("configured:", proxy, model)
print("hard-refresh SillyTavern in the browser")
PY
