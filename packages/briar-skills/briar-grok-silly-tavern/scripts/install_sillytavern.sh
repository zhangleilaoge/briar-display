#!/usr/bin/env bash
# Install SillyTavern (Node.js ONLY — no Go). Idempotent-ish.
# Prefers existing $BRIAR_ST_HOME (default ~/Documents/github/SillyTavern).
set -euo pipefail

ST_HOME="${ST_HOME:-${BRIAR_ST_HOME:-$HOME/Documents/github/SillyTavern}}"
BRIAR_ST_HOME="$ST_HOME"
BRIAR_ST_BRANCH="${BRIAR_ST_BRANCH:-release}"
MODE="${1:-auto}" # auto | launcher-hint | clone

err() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "INFO: $*"; }
warn() { echo "WARN: $*" >&2; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || err "missing command: $1"; }

check_node() {
  need_cmd node
  need_cmd npm
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -lt 20 ]]; then
    err "Node >= 20 required for SillyTavern (found $(node -v)). Go is NOT used for ST."
  fi
  info "Node $(node -v) OK (SillyTavern does not need Go)"
}

npm_install_busy() {
  # Heuristic: another npm install writing node_modules
  if pgrep -fl "npm install" 2>/dev/null | grep -F "$BRIAR_ST_HOME" >/dev/null 2>&1; then
    return 0
  fi
  # lock file freshly touched + incomplete node_modules
  if [[ -f "$BRIAR_ST_HOME/package-lock.json" || -f "$BRIAR_ST_HOME/npm-shrinkwrap.json" ]]; then
    if [[ -d "$BRIAR_ST_HOME/node_modules" ]] && [[ ! -f "$BRIAR_ST_HOME/node_modules/.package-lock.json" ]] \
      && [[ -n "$(find "$BRIAR_ST_HOME/node_modules" -maxdepth 0 -mmin -30 2>/dev/null)" ]]; then
      # weak signal only
      :
    fi
  fi
  return 1
}

install_clone() {
  check_node
  need_cmd git
  mkdir -p "$(dirname "$BRIAR_ST_HOME")"

  if [[ -d "$BRIAR_ST_HOME/.git" ]]; then
    info "existing checkout: $BRIAR_ST_HOME"
    if npm_install_busy; then
      warn "npm install appears in progress under $BRIAR_ST_HOME — will NOT fight it. Re-run later."
      exit 0
    fi
    if [[ -d "$BRIAR_ST_HOME/node_modules" ]]; then
      info "node_modules already present; skip npm install (set BRIAR_ST_FORCE_NPM=1 to reinstall)"
      if [[ "${BRIAR_ST_FORCE_NPM:-}" == "1" ]]; then
        (cd "$BRIAR_ST_HOME" && npm install)
      fi
    else
      info "running npm install in $BRIAR_ST_HOME"
      (cd "$BRIAR_ST_HOME" && npm install)
    fi
  else
    if [[ -e "$BRIAR_ST_HOME" ]]; then
      err "path exists but is not a git repo: $BRIAR_ST_HOME"
    fi
    info "cloning SillyTavern ($BRIAR_ST_BRANCH) → $BRIAR_ST_HOME"
    git clone --branch "$BRIAR_ST_BRANCH" --depth 1 \
      https://github.com/SillyTavern/SillyTavern.git "$BRIAR_ST_HOME"
    (cd "$BRIAR_ST_HOME" && npm install)
  fi

  if [[ ! -x "$BRIAR_ST_HOME/start.sh" && -f "$BRIAR_ST_HOME/start.sh" ]]; then
    chmod +x "$BRIAR_ST_HOME/start.sh" || true
  fi
  info "SillyTavern ready at $BRIAR_ST_HOME (Node only)"
}

print_launcher_hint() {
  cat <<'EOF'
=== Official SillyTavern-Launcher path (macOS) ===
Docs: https://docs.sillytavern.app/installation/linuxmacos/

  # Homebrew + git if needed, then:
  git clone https://github.com/SillyTavern/SillyTavern-Launcher.git
  cd SillyTavern-Launcher
  chmod +x install.sh && ./install.sh
  chmod +x launcher.sh && ./launcher.sh

Launcher installs ST + Node tooling. Go is NOT required for SillyTavern.
After Launcher install, point BRIAR_ST_HOME at the ST tree the launcher created
(or keep using ~/Documents/github/SillyTavern if that is your checkout).
EOF
}

case "$MODE" in
  launcher-hint) print_launcher_hint ;;
  clone) install_clone ;;
  auto)
    print_launcher_hint
    echo
    info "auto: also ensuring clone/npm at BRIAR_ST_HOME=$BRIAR_ST_HOME"
    install_clone
    ;;
  *) err "usage: $0 [auto|launcher-hint|clone]" ;;
esac
