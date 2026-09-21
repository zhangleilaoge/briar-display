#!/usr/bin/env bash
# Start grok2api (Go) on :8904 via nohup + pid file. Not for SillyTavern.
set -euo pipefail

Grok2API_HOME="${Grok2API_HOME:-${BRIAR_G2A_HOME:-$HOME/Documents/github/grok2api}}"
BRIAR_G2A_PORT="${BRIAR_G2A_PORT:-8904}"
PID_FILE="${Grok2API_HOME}/grok2api.pid"
LOG_FILE="${Grok2API_HOME}/grok2api.nohup.log"

err() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "INFO: $*"; }

[[ -d "$Grok2API_HOME" ]] || err "missing $Grok2API_HOME — run install_grok2api.sh first"
[[ -x "$Grok2API_HOME/grok2api" ]] || err "missing executable $Grok2API_HOME/grok2api"
[[ -f "$Grok2API_HOME/config.yaml" ]] || err "missing $Grok2API_HOME/config.yaml"

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$BRIAR_G2A_PORT" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  return 1
}

if is_running; then
  info "grok2api already running (pid_file=$PID_FILE port=$BRIAR_G2A_PORT)"
  exit 0
fi

cd "$Grok2API_HOME"
info "starting ./grok2api --config config.yaml (port $BRIAR_G2A_PORT) under nohup"
# Port comes from config.yaml in the live lab; do not fight it.
nohup ./grok2api --config config.yaml >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
sleep 1
if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  err "grok2api exited immediately — see $LOG_FILE"
fi
info "grok2api pid=$(cat "$PID_FILE") log=$LOG_FILE"
info "health: curl -sS http://127.0.0.1:${BRIAR_G2A_PORT}/healthz"
