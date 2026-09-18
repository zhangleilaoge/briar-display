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

# node probe + cooldown clear + smoke (single source of truth)
"$DIR/fix_grok_upstream.sh"
