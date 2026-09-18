#!/usr/bin/env bash
# Stop grok2api started by start_grok2api.sh (pid file).
set -euo pipefail

Grok2API_HOME="${Grok2API_HOME:-${BRIAR_G2A_HOME:-$HOME/Documents/github/grok2api}}"
BRIAR_G2A_PORT="${BRIAR_G2A_PORT:-8000}"
PID_FILE="${Grok2API_HOME}/grok2api.pid"

err() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "INFO: $*"; }

stop_pid() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    info "sending TERM to pid $pid"
    kill "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "$pid" 2>/dev/null; then
      info "sending KILL to pid $pid"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${pid}" ]]; then
    stop_pid "$pid"
  fi
  rm -f "$PID_FILE"
  info "removed $PID_FILE"
else
  info "no pid file at $PID_FILE"
fi

# Best-effort: if something still listens on 8000 and looks like grok2api, warn only.
if command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:"$BRIAR_G2A_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    info "WARN: port $BRIAR_G2A_PORT still listening — stop manually if needed (lsof -iTCP:$BRIAR_G2A_PORT -sTCP:LISTEN)"
  fi
fi
info "stop_grok2api done"
