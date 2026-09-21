#!/usr/bin/env bash
# Stop SillyTavern started by start_sillytavern.sh (pid file + port fallback).
set -euo pipefail

ST_HOME="${ST_HOME:-${BRIAR_ST_HOME:-$HOME/Documents/github/SillyTavern}}"
BRIAR_ST_PORT="${BRIAR_ST_PORT:-8905}"
PID_FILE="${ST_HOME}/sillytavern.pid"

err() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "INFO: $*"; }

stop_pid() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    info "sending TERM to pid $pid"
    kill "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${pid}" ]]; then
    stop_pid "$pid"
    # Also stop child node if start.sh spawned one (best-effort process group)
    if kill -0 "$pid" 2>/dev/null; then
      :
    fi
  fi
  rm -f "$PID_FILE"
  info "removed $PID_FILE"
else
  info "no pid file at $PID_FILE"
fi

# Fallback: kill listener on ST port if still up (macOS lsof)
if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -tiTCP:"$BRIAR_ST_PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    info "TERM listeners on :$BRIAR_ST_PORT → $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids2="$(lsof -tiTCP:"$BRIAR_ST_PORT" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids2}" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids2 2>/dev/null || true
    fi
  fi
fi
info "stop_sillytavern done"
