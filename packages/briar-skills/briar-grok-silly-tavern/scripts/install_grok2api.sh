#!/usr/bin/env bash
# Install grok2api (Go reverse proxy). Prefer native go build over Docker.
set -euo pipefail

Grok2API_HOME="${Grok2API_HOME:-${BRIAR_G2A_HOME:-$HOME/Documents/github/grok2api}}"
BRIAR_G2A_HOME="$Grok2API_HOME"
REPO_URL="${BRIAR_G2A_REPO:-https://github.com/chenyme/grok2api.git}"

err() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "INFO: $*"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || err "missing command: $1 (Go is required ONLY for grok2api, not for SillyTavern)"; }

need_cmd git
need_cmd go

mkdir -p "$(dirname "$BRIAR_G2A_HOME")"

if [[ -d "$BRIAR_G2A_HOME/.git" ]]; then
  info "existing grok2api checkout: $BRIAR_G2A_HOME"
else
  if [[ -e "$BRIAR_G2A_HOME" ]]; then
    err "path exists but is not a git repo: $BRIAR_G2A_HOME"
  fi
  info "cloning $REPO_URL → $BRIAR_G2A_HOME"
  git clone --depth 1 "$REPO_URL" "$BRIAR_G2A_HOME"
fi

cd "$BRIAR_G2A_HOME"

# Prefer Makefile / documented build; fall back to go build ./...
if [[ -f Makefile ]] && grep -qE '^(build|all):' Makefile; then
  info "make build"
  make build || make all || true
fi

if [[ ! -x ./grok2api && ! -x ./bin/grok2api ]]; then
  info "native go build"
  # Common layouts: main under cmd/ or repo root
  if [[ -d cmd ]]; then
    go build -o grok2api ./cmd/...
  else
    go build -o grok2api .
  fi
fi

if [[ -f config.example.yaml && ! -f config.yaml ]]; then
  cp config.example.yaml config.yaml
  chmod 600 config.yaml
  info "wrote config.yaml from example (chmod 600) — edit secrets locally, never commit"
fi

info "grok2api install done at $BRIAR_G2A_HOME"
info "Start with: bash scripts/start_grok2api.sh"
