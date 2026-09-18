#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/stop_sillytavern.sh" || true
"$DIR/stop_grok2api.sh" || true
echo "stopped (best-effort)"
