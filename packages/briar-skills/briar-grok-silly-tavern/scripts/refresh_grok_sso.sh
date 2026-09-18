#!/usr/bin/env bash
# Fast path when Grok SSO / proxy auth dies: harvest cookies via Kimi WebBridge → import grok2api → smoke.
# Never prints cookie values.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
G2A_PORT="${BRIAR_G2A_PORT:-8000}"

# ensure daemon
if [[ -x "$HOME/.kimi-webbridge/bin/kimi-webbridge" ]]; then
  "$HOME/.kimi-webbridge/bin/kimi-webbridge" start >/dev/null 2>&1 || true
fi

if ! curl -fsS --noproxy '*' "http://127.0.0.1:${G2A_PORT}/healthz" >/dev/null 2>&1; then
  echo "INFO: grok2api down — starting"
  "$DIR/start_grok2api.sh"
fi

echo "INFO: refreshing SSO via WebBridge (no cookie values logged)"
python3 "$DIR/import_grok_sso.py" --via-webbridge "$@"

KEY_FILE="${BRIAR_G2A_CLIENT_KEY:-$HOME/Documents/github/grok2api/.client_key}"
if [[ ! -f "$KEY_FILE" ]]; then
  KEY_FILE="$HOME/.config/briar-skills/grok2api-client.key"
fi
if [[ -f "$KEY_FILE" ]]; then
  echo "INFO: smoke chat completions (model grok-chat-fast)"
  KEY=$(cat "$KEY_FILE")
  code=$(curl -sS --noproxy '*' -o /tmp/g2a_smoke.json -w '%{http_code}' \
    -H "Authorization: Bearer ${KEY}" -H 'Content-Type: application/json' \
    -d '{"model":"grok-chat-fast","messages":[{"role":"user","content":"Reply with exactly: pong"}],"max_tokens":16}' \
    "http://127.0.0.1:${G2A_PORT}/v1/chat/completions" || true)
  echo "INFO: smoke HTTP $code"
  if [[ "$code" != "200" ]]; then
    echo "WARN: smoke failed — open grok.com in the WebBridge browser, login, re-run this script" >&2
    exit 2
  fi
  python3 -c "import json;d=json.load(open('/tmp/g2a_smoke.json'));print('INFO: reply', ((d.get('choices') or [{}])[0].get('message') or {}).get('content'))"
else
  echo "WARN: no client key at $KEY_FILE — SSO may be imported; create/copy client key then retry smoke"
fi
