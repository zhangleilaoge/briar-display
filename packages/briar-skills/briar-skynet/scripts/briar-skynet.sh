#!/bin/bash
# briar-skynet.sh - 天网日志查询工具（不依赖 zan-cli）
# Usage:
#   briar-skynet.sh search [options]
#   briar-skynet.sh export-status [options]
#   briar-skynet.sh download [options]

set -e

SKYNET_API_BASE="https://ops.qima-inc.com/v3/skynet/log/search"
DEFAULT_COOKIE_FILE="$HOME/.cache/zan-cli/auth/ops.qima-inc.com.cookies"

load_env() {
	GLOBAL_ENV="$HOME/.config/briar-skills/.env"
	if [ -f "$GLOBAL_ENV" ]; then
		set -a; source "$GLOBAL_ENV"; set +a
	fi
}

show_usage() {
	cat <<'EOF'
Usage:
  briar-skynet.sh search [options]
  briar-skynet.sh export-status --app <app> [options]
  briar-skynet.sh download --app <app> --export-id <exportId> [options]

Common options:
  --bu <bu>              Business unit: main (default) / fincloud
  --env <env>            Environment: prod (default) / qa / pre
  --cookie <cookie>      Cookie header value for ops.qima-inc.com
  --cookie-file <file>   Cookie JSON file, default: ~/.cache/zan-cli/auth/ops.qima-inc.com.cookies
  --json                 Output raw JSON where supported

Search options:
  --app <app>            Application name
  --hostname <hostname>  Hostname filter
  --level <level>        ERROR, WARN, INFO, DEBUG (comma-separated)
  --trace-id <traceId>   Filter by traceId
  --thread <thread>      Filter by thread name
  --query <query>        Keyword search
  --begin <begin>        Timestamp ms, ISO string, or relative time: -10m, -1h, -1d
  --end <end>            Timestamp ms, ISO string, or relative time
  --limit <limit>        Number of results, default: 20
  --direction <dir>      DESC (default) / ASC
  --after <after>        Pagination cursor

Download options:
  --idc <idc>            IDC filter, e.g. bd, bj5
  --output <dir>         Output directory, default: current directory

Examples:
  briar-skynet.sh search --app scrm-pc --env prod --query "分片" --begin -10m --limit 20
  briar-skynet.sh search --app scrm-pc --env prod --level ERROR --begin -1h
  briar-skynet.sh search --trace-id yz7-xxx --begin -1h --limit 50
  briar-skynet.sh export-status --app scrm-pc --env prod
  briar-skynet.sh download --app scrm-pc --export-id <exportId> --output /tmp
EOF
}

json_escape() {
	python3 -c 'import json,sys; print(json.dumps(sys.argv[1], ensure_ascii=False))' "$1"
}

parse_time_ms() {
	python3 - "$1" "$2" <<'PY'
import sys, time, datetime
value = sys.argv[1]
default_ms = int(sys.argv[2])
if not value:
    print(default_ms)
    raise SystemExit
if value.isdigit():
    print(int(value))
    raise SystemExit
if len(value) >= 3 and value[0] == '-' and value[1:-1].isdigit() and value[-1] in 'mhd':
    n = int(value[1:-1])
    unit = value[-1]
    seconds = {'m': 60, 'h': 3600, 'd': 86400}[unit]
    print(int(time.time() * 1000) - n * seconds * 1000)
    raise SystemExit
try:
    normalized = value.replace('Z', '+00:00')
    dt = datetime.datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.astimezone()
    print(int(dt.timestamp() * 1000))
except Exception:
    print(f'Invalid timestamp format: {value}', file=sys.stderr)
    raise SystemExit(1)
PY
}

read_cookie_from_file() {
	local file="$1"
	case "$file" in
		"~") file="$HOME" ;;
		"~/"*) file="$HOME/${file#~/}" ;;
	esac
	if [ ! -f "$file" ]; then
		return 1
	fi
	python3 - "$file" <<'PY'
import json, sys
path = sys.argv[1]
try:
    data = json.load(open(path, encoding='utf-8'))
except Exception:
    raise SystemExit(1)
parts = [f'{k}={v}' for k, v in data.items() if v]
if not parts:
    raise SystemExit(1)
print('; '.join(parts))
PY
}

resolve_cookie() {
	if [ -n "$COOKIE" ]; then
		printf '%s' "$COOKIE"
		return 0
	fi
	if [ -n "$BRIAR_SKYNET_COOKIE" ]; then
		printf '%s' "$BRIAR_SKYNET_COOKIE"
		return 0
	fi
	read_cookie_from_file "$COOKIE_FILE" || true
}

http_json() {
	local method="$1"
	local url="$2"
	local body="${3:-}"
	local cookie
	cookie=$(resolve_cookie)

	if [ -n "$body" ]; then
		if [ -n "$cookie" ]; then
			curl -sS -X "$method" "$url" \
				-H 'Content-Type: application/json' \
				-H "Cookie: $cookie" \
				-H "x-yz-bu: $BU" \
				-H "x-yz-env: $ENV" \
				--data-binary "$body"
		else
			curl -sS -X "$method" "$url" \
				-H 'Content-Type: application/json' \
				-H "x-yz-bu: $BU" \
				-H "x-yz-env: $ENV" \
				--data-binary "$body"
		fi
	else
		if [ -n "$cookie" ]; then
			curl -sS -X "$method" "$url" \
				-H "Cookie: $cookie" \
				-H "x-yz-bu: $BU" \
				-H "x-yz-env: $ENV"
		else
			curl -sS -X "$method" "$url" \
				-H "x-yz-bu: $BU" \
				-H "x-yz-env: $ENV"
		fi
	fi
}

format_search_result() {
	local input
	input=$(cat)
	python3 - "$input" <<'PY'
import json, sys, datetime
try:
    data = json.loads(sys.argv[1])
except Exception:
    print('Invalid JSON response')
    raise SystemExit(1)
if data.get('error') or data.get('message'):
    print('Search failed:', data.get('error') or data.get('message'))
    raise SystemExit(0)
logs = data.get('logEvents') or data.get('data', {}).get('logEvents') or []
if not logs:
    print('No logs found.')
    raise SystemExit(0)
print(f'Found {len(logs)} log entries:\n')
for i, event in enumerate(logs, 1):
    ts = event.get('timestamp') or 0
    try:
        time_text = datetime.datetime.fromtimestamp(ts / 1000).strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        time_text = str(ts)
    level = str(event.get('level') or '').ljust(5)
    app = event.get('appReporter') or event.get('app') or ''
    tags = event.get('tags') or {}
    message = str(event.get('message') or '')
    if len(message) > 500:
        message = message[:500] + '...'
    print(f'[{i}] {time_text} [{level}] {app}')
    print(f'    Host: {event.get("hostname") or ""}')
    print(f'    Logger: {event.get("loggerName") or ""}')
    if tags.get('_traceId'):
        print(f'    TraceId: {tags.get("_traceId")}')
    print(f'    Message: {message}')
    print()
if data.get('hasMore') or data.get('scrollTokens') or data.get('data', {}).get('after'):
    print('More results may be available.')
PY
}

format_export_status() {
	local input
	input=$(cat)
	python3 - "$input" <<'PY'
import json, sys, datetime
try:
    data = json.loads(sys.argv[1])
except Exception:
    print('Invalid JSON response')
    raise SystemExit(1)
if data.get('error') or data.get('message'):
    print('Query failed:', data.get('error') or data.get('message'))
    raise SystemExit(0)
tasks = data.get('taskStatus') or []
if not tasks:
    print('No export tasks found.')
    raise SystemExit(0)
def fmt_size(n):
    n = int(n or 0)
    for unit in ['B', 'KB', 'MB', 'GB']:
        if n < 1024 or unit == 'GB':
            return f'{n:.2f} {unit}' if unit != 'B' else f'{n} B'
        n /= 1024
by_export = {}
for task in tasks:
    by_export.setdefault(task.get('exportId'), []).append(task)
print(f'Found {len(tasks)} export task(s):\n')
for idx, (export_id, group) in enumerate(by_export.items(), 1):
    first = group[0]
    updated = first.get('lastUpdate') or 0
    try:
        updated_text = datetime.datetime.fromtimestamp(updated / 1000).strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        updated_text = str(updated)
    print(f'[{idx}] Export ID: {export_id}')
    print(f'    App: {first.get("app") or ""}')
    print(f'    Updated: {updated_text}')
    for task in group:
        print(f'    [{task.get("idc")}] {task.get("state")} - {fmt_size(task.get("size"))} ({task.get("done")}/{task.get("total")})')
        if task.get('state') == 'DONE':
            print(f'        Download: briar-skynet.sh download --app {task.get("app")} --export-id {task.get("exportId")} --idc {task.get("idc")}')
        if task.get('message'):
            print(f'        Message: {task.get("message")}')
    print()
PY
}

build_search_payload() {
	local now begin_ms end_ms payload
	now=$(python3 -c 'import time; print(int(time.time() * 1000))')
	begin_ms=$(parse_time_ms "$BEGIN" "$((now - 3600000))")
	end_ms=$(parse_time_ms "$END" "$now")
	python3 - "$begin_ms" "$end_ms" "$APP" "$HOSTNAME" "$LEVEL" "$TRACE_ID" "$THREAD" "$QUERY" "$DIRECTION" "$AFTER" "$LIMIT" <<'PY'
import json, sys
begin_ms, end_ms = int(sys.argv[1]), int(sys.argv[2])
app, hostname, level, trace_id, thread, query, direction, after, limit = sys.argv[3:12]
if end_ms - begin_ms > 7 * 24 * 60 * 60 * 1000:
    print('Time range cannot exceed 7 days.', file=sys.stderr)
    raise SystemExit(1)
payload = {
    'timestampBeginMs': begin_ms,
    'timestampEndMs': end_ms,
    'tagConditions': [],
    'direction': direction or 'DESC',
    'after': after or None,
    'limit': int(limit or 20),
}
if app:
    payload['app'] = app
if hostname:
    payload['hostname'] = hostname
if level:
    levels = [x.strip().upper() for x in level.split(',') if x.strip().upper() in {'ERROR','WARN','INFO','DEBUG'}]
    if levels:
        payload['levelArray'] = levels
if trace_id:
    payload['tagConditions'].append(['_traceId', 'eq', trace_id])
if thread:
    payload['tagConditions'].append(['_thread', 'eq', thread])
if query:
    payload['queryString'] = query
print(json.dumps(payload, ensure_ascii=False))
PY
}

search_logs() {
	local payload result
	payload=$(build_search_payload)
	result=$(http_json POST "$SKYNET_API_BASE/search" "$payload")
	if [ "$JSON_OUTPUT" = "1" ]; then
		printf '%s\n' "$result"
	else
		printf '%s\n' "$result" | format_search_result
	fi
}

export_status() {
	if [ -z "$APP" ]; then
		echo 'Error: --app is required.' >&2
		exit 1
	fi
	local result
	result=$(http_json GET "$SKYNET_API_BASE/export_status/$APP")
	if [ "$JSON_OUTPUT" = "1" ]; then
		printf '%s\n' "$result"
	else
		printf '%s\n' "$result" | format_export_status
	fi
}

download_logs() {
	if [ -z "$APP" ] || [ -z "$EXPORT_ID" ]; then
		echo 'Error: --app and --export-id are required.' >&2
		exit 1
	fi
	mkdir -p "$OUTPUT"
	local cookie status tasks
	cookie=$(resolve_cookie)
	status=$(http_json GET "$SKYNET_API_BASE/export_status/$APP")
	tasks=$(python3 - "$status" "$EXPORT_ID" "$IDC" <<'PY'
import json, sys
try:
    data = json.loads(sys.argv[1])
except Exception as exc:
    print(f'Invalid JSON response: {exc}', file=sys.stderr)
    raise SystemExit(1)
export_id = sys.argv[2]
idc = sys.argv[3]
tasks = [t for t in data.get('taskStatus', []) if t.get('exportId') == export_id]
if idc:
    tasks = [t for t in tasks if t.get('idc') == idc]
if not tasks:
    print(f'No export task found with exportId={export_id}' + (f' and idc={idc}' if idc else ''), file=sys.stderr)
    raise SystemExit(1)
not_done = [f"{t.get('idc')}: {t.get('state')}" for t in tasks if t.get('state') != 'DONE']
if not_done:
    print('Export tasks not ready: ' + ', '.join(not_done), file=sys.stderr)
    raise SystemExit(1)
for task in tasks:
    print(json.dumps(task, ensure_ascii=False))
PY
)
	while IFS= read -r task; do
		[ -z "$task" ] && continue
		local idc download_url output_file
		idc=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("idc") or "")' "$task")
		download_url=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("downloadUrl") or "")' "$task")
		output_file="$OUTPUT/${APP}_${idc}_${EXPORT_ID}.gz"
		echo "Downloading $idc logs to $output_file..."
		curl -sS -L "$download_url" -H "Cookie: $cookie" -o "$output_file"
		echo "Downloaded: $output_file"
	done <<< "$tasks"
}

load_env

ACTION="$1"
if [ -z "$ACTION" ] || [ "$ACTION" = "-h" ] || [ "$ACTION" = "--help" ]; then
	show_usage
	exit 0
fi
shift

BU="main"
ENV="prod"
COOKIE=""
COOKIE_FILE="${BRIAR_SKYNET_COOKIE_FILE:-$DEFAULT_COOKIE_FILE}"
JSON_OUTPUT="0"
APP=""
HOSTNAME=""
LEVEL=""
TRACE_ID=""
THREAD=""
QUERY=""
BEGIN=""
END=""
LIMIT="20"
DIRECTION="DESC"
AFTER=""
EXPORT_ID=""
IDC=""
OUTPUT="."

while [ $# -gt 0 ]; do
	case "$1" in
		--bu) BU="$2"; shift 2 ;;
		--env) ENV="$2"; shift 2 ;;
		--cookie) COOKIE="$2"; shift 2 ;;
		--cookie-file) COOKIE_FILE="$2"; shift 2 ;;
		--json) JSON_OUTPUT="1"; shift ;;
		--app) APP="$2"; shift 2 ;;
		--hostname) HOSTNAME="$2"; shift 2 ;;
		--level) LEVEL="$2"; shift 2 ;;
		--trace-id) TRACE_ID="$2"; shift 2 ;;
		--thread) THREAD="$2"; shift 2 ;;
		--query) QUERY="$2"; shift 2 ;;
		--begin) BEGIN="$2"; shift 2 ;;
		--end) END="$2"; shift 2 ;;
		--limit) LIMIT="$2"; shift 2 ;;
		--direction) DIRECTION="$2"; shift 2 ;;
		--after) AFTER="$2"; shift 2 ;;
		--export-id) EXPORT_ID="$2"; shift 2 ;;
		--idc) IDC="$2"; shift 2 ;;
		--output) OUTPUT="$2"; shift 2 ;;
		-h|--help) show_usage; exit 0 ;;
		*) echo "Error: unknown option: $1" >&2; show_usage; exit 1 ;;
	esac
done

case "$ACTION" in
	search) search_logs ;;
	export-status) export_status ;;
	download) download_logs ;;
	*) echo "Error: unknown action: $ACTION" >&2; show_usage; exit 1 ;;
esac
