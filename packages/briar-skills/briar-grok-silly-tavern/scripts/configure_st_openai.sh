#!/usr/bin/env bash
# Point SillyTavern Chat Completion at local grok2api.
# With reverse_proxy set, Bearer comes from proxy_password (not api_key_openai).
# Also writes proxies[] + connectionManager profile "grok2api-local".
# IMPORTANT: stop ST or hard-refresh immediately after — a live empty tab wipes settings.
# See references/st-api-connect.md and examples/st-api-connection-red-but-filled.md
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ST_USER="${ST_USER_DIR:-$HOME/Documents/github/SillyTavern/data/default-user}"
G2A_HOME="${GROK2API_HOME:-$HOME/Documents/github/grok2api}"
KEY_FILE="${G2A_CLIENT_KEY_FILE:-$G2A_HOME/.client_key}"
PROXY_URL="${G2A_PROXY_URL:-http://127.0.0.1:8904/v1}"
MODEL="${G2A_MODEL:-grok-chat-fast}"
PROFILE_NAME="${G2A_ST_PROFILE:-grok2api-local}"
[[ -f "$KEY_FILE" ]] || { echo "missing $KEY_FILE" >&2; exit 1; }
[[ -f "$ST_USER/settings.json" ]] || { echo "missing settings.json — start SillyTavern once first" >&2; exit 1; }
KEY=$(cat "$KEY_FILE")
python3 "$DIR/configure_st_openai_impl.py" "$ST_USER" "$KEY" "$PROXY_URL" "$MODEL" "$PROFILE_NAME"
echo "stop/restart ST or hard-refresh NOW — a live empty tab can wipe this"
