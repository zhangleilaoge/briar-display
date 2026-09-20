#!/usr/bin/env bash
# Fix "连接上游服务失败" / chat 502 when the local proxy is fine but grok2api
# is stuck: egress node probe + cooldown clear (both persist in sqlite and
# survive restarts), then a smoke chat. Never prints secrets.
#
# Usage: bash fix_grok_upstream.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
G2A_PORT="${BRIAR_G2A_PORT:-8000}"

if ! curl -fsS --noproxy '*' -m 5 "http://127.0.0.1:${G2A_PORT}/healthz" >/dev/null 2>&1; then
  echo "INFO: grok2api down — starting"
  "$DIR/start_grok2api.sh"
fi

python3 - "$DIR" <<'PYEOF'
import json, sys, urllib.request
sys.path.insert(0, sys.argv[1])
import import_grok_sso as g

user, pw = g.admin_creds()
base = f'{g.G2A}/api/admin/v1'

def req(path, data=None, token=None, method=None):
    r = urllib.request.Request(base + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})},
        method=method)
    try:
        with urllib.request.urlopen(r, timeout=90) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        return {'http_error': e.code, 'body': e.read().decode('utf-8', 'replace')[:300]}

status, login = g.http_json(f'{base}/auth/login', method='POST', body={'username': user, 'password': pw})
token = ((login.get('data') or {}).get('tokens') or {}).get('accessToken')
if not token:
    g.die(f'admin login failed: {str(login)[:200]}')

nodes = req('/egress-nodes', token=token).get('data') or {}
for n in (nodes.get('items') or []):
    nid = n.get('id')
    res = req(f'/egress-nodes/{nid}/test', {}, token)
    d = res.get('data') or {}
    print(f"INFO: node {nid} {n.get('name')} probe → {d.get('status') or res} latency={d.get('latencyMs')}ms")
    if (d.get('status') or '') != 'healthy':
        print('WARN: node probe unhealthy — local proxy down or exit IP blocked; start/switch proxy then rerun', file=sys.stderr)

accts = req('/accounts', token=token).get('data') or {}
for a in (accts.get('items') or []):
    if a.get('provider') != 'grok_web':
        continue
    res = req(f"/accounts/{a['id']}/clear-cooldown", {}, token)
    print(f"INFO: account {a['id']} clear-cooldown → {'ok' if 'data' in res else res}")
PYEOF

KEY_FILE="${BRIAR_G2A_CLIENT_KEY:-$HOME/Documents/github/grok2api/.client_key}"
if [[ -f "$KEY_FILE" ]]; then
  KEY=$(cat "$KEY_FILE")
  code=$(curl -sS --noproxy '*' -o /tmp/g2a_smoke.json -w '%{http_code}' -m 90 \
    -H "Authorization: Bearer ${KEY}" -H 'Content-Type: application/json' \
    -d '{"model":"grok-chat-fast","messages":[{"role":"user","content":"Reply with exactly: pong"}],"max_tokens":16}' \
    "http://127.0.0.1:${G2A_PORT}/v1/chat/completions" || true)
  echo "INFO: smoke HTTP $code"
  if [[ "$code" == "200" ]]; then
    python3 -c "import json;d=json.load(open('/tmp/g2a_smoke.json'));print('INFO: reply', ((d.get('choices') or [{}])[0].get('message') or {}).get('content'))"
  else
    head -c 300 /tmp/g2a_smoke.json; echo
    echo "WARN: smoke still failing — if grok2api log shows 'Grok index 返回 403', the proxy exit IP is Cloudflare-blocked: switch node in the proxy client, then rerun this script" >&2
    exit 2
  fi
else
  echo "WARN: no client key at $KEY_FILE — skipped smoke"
fi
