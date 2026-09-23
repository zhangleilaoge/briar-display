#!/usr/bin/env bash
# Env: XHS_TITLE XHS_CONTENT XHS_IMAGE (required); XHS_TAGS comma-separated optional
# Optional: XHS_MCP_HOME XHS_PORT
set -euo pipefail
HOME_DIR="${XHS_MCP_HOME:-$HOME/tools/xiaohongshu-mcp}"
PORT="${XHS_PORT:-18060}"
BIN="$HOME_DIR/xiaohongshu-mcp-darwin-arm64"
TITLE="${XHS_TITLE:?set XHS_TITLE}"
CONTENT="${XHS_CONTENT:?set XHS_CONTENT}"
IMAGE="${XHS_IMAGE:?set XHS_IMAGE absolute path}"
TAGS_CSV="${XHS_TAGS:-彩礼,求婚,结婚}"

unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy || true
test -x "$BIN" || { echo "missing $BIN"; exit 1; }
test -f "$IMAGE" || { echo "missing image $IMAGE"; exit 1; }
test -f "$HOME_DIR/cookies.json" || { echo "missing cookies.json — run export script first"; exit 1; }

pkill -f xiaohongshu-mcp-darwin-arm64 2>/dev/null || true
sleep 1
: > /tmp/xhs-mcp.log
(cd "$HOME_DIR" && nohup "$BIN" -headless=true -port=":$PORT" > /tmp/xhs-mcp.log 2>&1 &)
echo $! > /tmp/xhs-mcp.pid
cleanup() { kill "$(cat /tmp/xhs-mcp.pid 2>/dev/null)" 2>/dev/null || pkill -f xiaohongshu-mcp-darwin-arm64 || true; }
trap cleanup EXIT

for i in $(seq 1 40); do
  curl -s -m 2 --noproxy '*' "http://127.0.0.1:$PORT/health" | grep -q healthy && break
  sleep 1
done

LOGIN=$(curl -s -m 120 --noproxy '*' "http://127.0.0.1:$PORT/api/v1/login/status")
echo "$LOGIN" | grep -q '"is_logged_in":true' || { echo "not logged in: $LOGIN"; exit 1; }

python3 - "$TITLE" "$CONTENT" "$IMAGE" "$TAGS_CSV" "$PORT" <<'PY'
import json, sys, urllib.request
title, content, image, tags_csv, port = sys.argv[1:6]
tags = [t.strip() for t in tags_csv.split(",") if t.strip()]
payload = {"title": title, "content": content, "images": [image], "tags": tags}
req = urllib.request.Request(
    f"http://127.0.0.1:{port}/api/v1/publish",
    data=json.dumps(payload, ensure_ascii=False).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
# bypass env proxy
proxy_handler = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_handler)
with opener.open(req, timeout=150) as r:
    print(r.read().decode())
PY
