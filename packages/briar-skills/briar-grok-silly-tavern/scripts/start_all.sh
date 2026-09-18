#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/start_grok2api.sh"
"$DIR/start_sillytavern.sh"
echo "open http://127.0.0.1:${ST_PORT:-8001}/  (API via grok2api :${GROK2API_PORT:-8000})"
