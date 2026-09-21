#!/usr/bin/env bash
# One-shot: start grok2api (:8904) then SillyTavern (:8905).
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
G2A_PORT="${BRIAR_G2A_PORT:-8904}"
ST_PORT="${BRIAR_ST_PORT:-8905}"

"$DIR/start_grok2api.sh"
"$DIR/start_sillytavern.sh"

wait_http() {
  local url="$1" name="$2" n="${3:-40}"
  local i
  for i in $(seq 1 "$n"); do
    if curl -fsS --noproxy '*' "$url" >/dev/null 2>&1; then
      echo "OK  $name  $url"
      return 0
    fi
    sleep 0.5
  done
  echo "WARN $name not healthy yet: $url" >&2
  return 1
}

wait_http "http://127.0.0.1:${G2A_PORT}/healthz" "grok2api" 30 || true
wait_http "http://127.0.0.1:${ST_PORT}/" "SillyTavern" 60 || true

cat <<MSG
---
both start scripts finished
  grok2api:    http://127.0.0.1:${G2A_PORT}/   (OpenAI /v1)
  SillyTavern: http://127.0.0.1:${ST_PORT}/
stop:  bash $DIR/stop_all.sh
SSO refresh if chat 401/503:  bash $DIR/refresh_grok_sso.sh
MSG
