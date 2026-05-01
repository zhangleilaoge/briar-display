#!/usr/bin/env bash
set -euo pipefail

# Briar 增量索引更新器
# 特点：防抖（每小时最多更新一次）+ commit 去重（无变化不更新）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ZOEKT_INDEX_DIR="${ZOEKT_INDEX_DIR:-$PROJECT_DIR/.zoekt}"
STATE_FILE="$ZOEKT_INDEX_DIR/.update_state.json"
UPDATE_LOCK="$ZOEKT_INDEX_DIR/.update_lock"
export PATH="/opt/homebrew/bin:$PATH:/usr/local/go/bin:$HOME/go/bin"

log_info() { echo "[UPDATE] $(date '+%H:%M:%S') $*" >&2; }

# 读取仓库当前 commit
get_repo_commit() {
    local repo="$1"
    if [[ -d "$repo/.git" ]]; then
        (cd "$repo" && git rev-parse HEAD 2>/dev/null) || echo ""
    else
        echo ""
    fi
}

# 检查是否需要更新（防抖 + commit 去重）
should_update() {
    local repo="$1"
    local current_commit="$2"

    if [[ ! -f "$STATE_FILE" ]]; then
        return 0  # 没有状态记录，需要更新
    fi

    local last_update last_commit
    last_update=$(python3 -c "
import json, sys
repo = sys.argv[1]
try:
    with open('$STATE_FILE') as f:
        state = json.load(f)
    print(state.get('repos', {}).get(repo, {}).get('last_update', ''))
except:
    print('')
" "$repo")

    last_commit=$(python3 -c "
import json, sys
repo = sys.argv[1]
try:
    with open('$STATE_FILE') as f:
        state = json.load(f)
    print(state.get('repos', {}).get(repo, {}).get('last_commit', ''))
except:
    print('')
" "$repo")

    # commit 没变，跳过
    if [[ "$last_commit" == "$current_commit" && -n "$current_commit" ]]; then
        return 1  # 不需要更新
    fi

    # 检查时间间隔（1小时 = 3600秒）
    if [[ -n "$last_update" ]]; then
        local last_epoch now_epoch diff
        last_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "$last_update" "+%s" 2>/dev/null || date -d "$last_update" "+%s" 2>/dev/null || echo 0)
        now_epoch=$(date "+%s")
        diff=$((now_epoch - last_epoch))
        if [[ $diff -lt 3600 ]]; then
            log_info "跳过 $repo（${diff}秒前已更新，未满1小时）"
            return 1
        fi
    fi

    return 0
}

# 记录更新状态
record_update() {
    local repo="$1"
    local commit="$2"
    local now
    now=$(date "+%Y-%m-%dT%H:%M:%S")

    python3 -c "
import json, os
state_file = '$STATE_FILE'
repo = '$repo'
commit = '$commit'
now = '$now'

try:
    with open(state_file) as f:
        state = json.load(f)
except:
    state = {'repos': {}}

if 'repos' not in state:
    state['repos'] = {}

state['repos'][repo] = {
    'last_update': now,
    'last_commit': commit
}

with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
" 2>/dev/null || true
}

# 更新单个仓库
update_repo() {
    local repo="$1"
    local current_commit
    current_commit=$(get_repo_commit "$repo")

    if [[ -z "$current_commit" ]]; then
        log_info "跳过 $repo（无法获取 commit）"
        return
    fi

    if ! should_update "$repo" "$current_commit"; then
        return
    fi

    log_info "增量更新: $(basename "$repo") ($current_commit)"
    zoekt-git-index -index "$ZOEKT_INDEX_DIR" "$repo" >/dev/null 2>&1 || {
        log_info "更新失败: $repo"
        return
    }
    record_update "$repo" "$current_commit"
    log_info "完成: $(basename "$repo")"
}

# 主流程
main() {
    # 防止并发更新
    if [[ -f "$UPDATE_LOCK" ]]; then
        local pid
        pid=$(cat "$UPDATE_LOCK" 2>/dev/null)
        if kill -0 "$pid" 2>/dev/null; then
            log_info "已有更新进程在运行 (PID: $pid)，跳过"
            exit 0
        fi
    fi
    echo $$ > "$UPDATE_LOCK"
    trap 'rm -f "$UPDATE_LOCK"' EXIT

    # 如果没有指定仓库，从 /tmp/repos.list 读取
    if [[ $# -eq 0 ]]; then
        if [[ -f /tmp/repos.list ]]; then
            while IFS= read -r repo; do
                [[ -z "$repo" || ! -d "$repo/.git" ]] && continue
                update_repo "$repo"
            done < /tmp/repos.list
        else
            log_info "未找到仓库列表 (/tmp/repos.list)"
            exit 1
        fi
    else
        for repo in "$@"; do
            [[ -d "$repo/.git" ]] && update_repo "$repo"
        done
    fi
}

main "$@"
