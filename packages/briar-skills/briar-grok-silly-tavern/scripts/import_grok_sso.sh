#!/usr/bin/env bash
# Wrapper: CDP harvest + grok2api SSO import (no cookie values echoed).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/import_grok_sso.py" "$@"
