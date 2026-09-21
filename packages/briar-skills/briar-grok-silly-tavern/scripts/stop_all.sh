#!/usr/bin/env bash
# Stop SillyTavern (:8905) and grok2api (:8904). Best-effort; safe to re-run.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
G2A_PORT="${BRIAR_G2A_PORT:-8904}"
ST_PORT="${BRIAR_ST_PORT:-8905}"

echo "INFO: stopping SillyTavern + grok2api"
"$DIR/stop_sillytavern.sh" || true
"$DIR/stop_grok2api.sh" || true

# Port fallback for grok2api (stop_grok2api only warns)
if command -v lsof >/dev/null 2>&1; then
  for port in "$ST_PORT" "$G2A_PORT"; do
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "INFO: leftover listeners on :$port → $pids — TERM"
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
      sleep 0.8
      pids2="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
      if [[ -n "${pids2}" ]]; then
        echo "INFO: KILL :$port → $pids2"
        # shellcheck disable=SC2086
        kill -9 $pids2 2>/dev/null || true
      fi
    fi
  done
fi

still=0
for port in "$G2A_PORT" "$ST_PORT"; do
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "WARN: port $port still listening"
    still=1
  else
    echo "OK   :$port free"
  fi
done
if [[ "$still" -eq 0 ]]; then
  echo "stopped all"
else
  echo "stopped with warnings" >&2
  exit 1
fi
