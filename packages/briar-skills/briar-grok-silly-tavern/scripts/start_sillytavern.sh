#!/usr/bin/env bash
# Start SillyTavern (Node.js ONLY — never calls Go) on :8905 via nohup + pid file.
# Live lab: ST 1.14.0 release at ~/Documents/github/SillyTavern, config.yaml port 8905.
set -euo pipefail

ST_HOME="${ST_HOME:-${BRIAR_ST_HOME:-$HOME/Documents/github/SillyTavern}}"
BRIAR_ST_PORT="${BRIAR_ST_PORT:-8905}"
PID_FILE="${ST_HOME}/sillytavern.pid"
LOG_FILE="${ST_HOME}/sillytavern.nohup.log"

err() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "INFO: $*"; }

[[ -d "$ST_HOME" ]] || err "missing $ST_HOME — run install_sillytavern.sh or set ST_HOME/BRIAR_ST_HOME"
[[ -f "$ST_HOME/start.sh" ]] || err "missing $ST_HOME/start.sh"

if ! command -v node >/dev/null 2>&1; then
  err "node not found (SillyTavern needs Node >= 20; Go is irrelevant here)"
fi

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$BRIAR_ST_PORT" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  return 1
}

if is_running; then
  info "SillyTavern already running (pid_file=$PID_FILE port=$BRIAR_ST_PORT)"
  exit 0
fi

# Soft check: config.yaml should pin port 8905 (do not rewrite while parent may be editing).
if [[ -f "$ST_HOME/config.yaml" ]]; then
  if command -v rg >/dev/null 2>&1; then
    if ! rg -n "^port:\s*${BRIAR_ST_PORT}\b|port:\s*${BRIAR_ST_PORT}\b" "$ST_HOME/config.yaml" >/dev/null 2>&1; then
      info "WARN: expected port $BRIAR_ST_PORT in $ST_HOME/config.yaml — live lab uses 8905 to avoid clashing with grok2api :8904"
    fi
  fi
else
  info "WARN: no config.yaml yet — ensure listen port is $BRIAR_ST_PORT (not the grok2api port)"
fi

cd "$ST_HOME"
chmod +x ./start.sh 2>/dev/null || true
info "starting ./start.sh under nohup (Node only; port from config.yaml, expect $BRIAR_ST_PORT)"
nohup ./start.sh >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
sleep 2
if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  # start.sh may exec node and replace shell — check port instead
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$BRIAR_ST_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    info "start.sh launcher exited but port $BRIAR_ST_PORT is listening — OK"
    exit 0
  fi
  err "SillyTavern appears down — see $LOG_FILE"
fi
info "SillyTavern pid=$(cat "$PID_FILE") log=$LOG_FILE"
info "UI: http://127.0.0.1:${BRIAR_ST_PORT}/"
