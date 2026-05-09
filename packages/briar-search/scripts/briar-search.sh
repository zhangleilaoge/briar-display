#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$PROJECT_DIR/config"
ZOEKT_INDEX_DIR="${ZOEKT_INDEX_DIR:-$PROJECT_DIR/.zoekt}"
ZOEKT_HOST="${ZOEKT_HOST:-http://localhost:6070}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*" >&2; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*" >&2; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

show_help() {
    cat << 'EOF'
用法: briar-search [选项] <查询语句>

在 Briar 代码搜索引擎中执行查询。

选项:
  -h, --help              显示帮助信息
  -d, --domain DOMAIN     按业务域筛选（如: 导购, CRM, 支付）
  -r, --repo REPO         按仓库名筛选（支持通配符）
  -l, --language LANG     按编程语言筛选（如: go, java, python）
  -f, --file FILE         按文件路径筛选（支持通配符）
  -n, --num NUM           返回结果数量（默认: 20）
  --json                  输出 JSON 格式
  --raw                   输出 Zoekt 原始响应
  --host URL              Zoekt 服务地址（默认: http://localhost:6070）

查询语法:
  普通关键词:              "rebind"
  正则表达式:              "func.*Rebind"
  文件过滤:                "file:.*\\.go"
  仓库过滤:                "repo:guide-.*"
  布尔组合:                "rebind AND guide"
  短语搜索:                "\"导购换绑\""

示例:
  briar-search "rebind"
  briar-search -d 导购 "换绑"
  briar-search -d CRM -l go "customer"
  briar-search -r "guide-*" "func.*Rebind"
  briar-search --json "导购 AND 换绑"

混合查询（自然语言）:
  briar-search "导购换绑功能实现"
  briar-search -d 支付 "收银台退款逻辑"
EOF
}

# 参数解析
QUERY=""
DOMAIN=""
REPO_FILTER=""
LANGUAGE=""
FILE_PATTERN=""
NUM_RESULTS=20
JSON_OUTPUT=false
RAW_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -r|--repo)
            REPO_FILTER="$2"
            shift 2
            ;;
        -l|--language)
            LANGUAGE="$2"
            shift 2
            ;;
        -f|--file)
            FILE_PATTERN="$2"
            shift 2
            ;;
        -n|--num)
            NUM_RESULTS="$2"
            shift 2
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --raw)
            RAW_OUTPUT=true
            shift
            ;;
        --host)
            ZOEKT_HOST="$2"
            shift 2
            ;;
        -*)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
        *)
            if [[ -z "$QUERY" ]]; then
                QUERY="$1"
            else
                QUERY="$QUERY $1"
            fi
            shift
            ;;
    esac
done

# 检查依赖
check_deps() {
    if ! command -v curl &>/dev/null; then
        log_error "curl 未安装"
        exit 1
    fi
    if ! command -v python3 &>/dev/null; then
        log_error "python3 未安装"
        exit 1
    fi
}

# 后台延迟增量更新（查询结果中的相关仓库）
trigger_delayed_update() {
    local response="$1"
    local delay="${BRIAR_UPDATE_DELAY:-5}"

    # 提取查询结果中的仓库列表
    local repos_json
    repos_json=$(python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    files = data.get('Result', {}).get('Files', [])
    repos = list(set(f.get('Repository', '') for f in files if f.get('Repository')))
    print(json.dumps(repos))
except:
    print('[]')
" <<< "$response" 2>/dev/null)

    if [[ "$repos_json" == "[]" || -z "$repos_json" ]]; then
        return
    fi

    # 通过 repo-map.json 找到本地路径
    local map_file="$CONFIG_DIR/repo-map.json"
    if [[ ! -f "$map_file" ]]; then
        return
    fi

    # 后台延迟更新
    (
        sleep "$delay"
        python3 -c "
import json, subprocess, sys

repos = json.loads('''$repos_json''')
map_file = '$map_file'
script_dir = '$SCRIPT_DIR'

with open(map_file) as f:
    mapping = json.load(f)

# 收集需要更新的本地路径
paths = []
for repo_name in repos:
    if repo_name in mapping:
        paths.append(mapping[repo_name])
    else:
        # 尝试模糊匹配
        for url, path in mapping.items():
            if repo_name in url or url in repo_name:
                paths.append(path)
                break

if paths:
    # 去重
    paths = list(set(paths))
    # 调用 briar-update.sh
    subprocess.Popen(
        [script_dir + '/briar-update.sh'] + paths,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
" 2>/dev/null
    ) &>/dev/null &
}

# 构建 Zoekt 查询语法
build_query() {
    local query="$QUERY"
    local filters=()

    # 业务域筛选 → 映射为仓库名通配
    if [[ -n "$DOMAIN" ]]; then
        local domains_file="$CONFIG_DIR/domains.json"
        local repo_patterns=()

        if [[ -f "$domains_file" ]]; then
            if command -v jq &>/dev/null; then
                while IFS= read -r pattern; do
                    [[ -n "$pattern" ]] && repo_patterns+=("$pattern")
                done < <(jq -r --arg d "$DOMAIN" '.domains[$d].repo_patterns[]?' "$domains_file")
            elif command -v python3 &>/dev/null; then
                mapfile -t repo_patterns < <(python3 -c "
import json, sys
domain = sys.argv[1]
with open('$domains_file') as f:
    config = json.load(f)
for p in config.get('domains', {}).get(domain, {}).get('repo_patterns', []):
    print(p)
" "$DOMAIN")
            fi
        fi

        if [[ ${#repo_patterns[@]} -gt 0 ]]; then
            # Zoekt repo 过滤使用正则 | 作为 OR，不是 OR 关键字
            local repo_regex=""
            for p in "${repo_patterns[@]}"; do
                # 将 shell 通配符 * 转为正则 .*，? 转为 .
                local regex_p="${p//\*\/.*}"
                regex_p="${regex_p//\?/.}"
                if [[ -z "$repo_regex" ]]; then
                    repo_regex="$regex_p"
                else
                    repo_regex="$repo_regex|$regex_p"
                fi
            done
            filters+=("repo:$repo_regex")
        fi
    fi

    # 仓库筛选
    if [[ -n "$REPO_FILTER" ]]; then
        filters+=("repo:$REPO_FILTER")
    fi

    # 语言筛选
    if [[ -n "$LANGUAGE" ]]; then
        filters+=("lang:$LANGUAGE")
    fi

    # 文件筛选
    if [[ -n "$FILE_PATTERN" ]]; then
        filters+=("file:$FILE_PATTERN")
    fi

    # 组合查询
    if [[ ${#filters[@]} -gt 0 ]]; then
        local filter_str=""
        for f in "${filters[@]}"; do
            if [[ -z "$filter_str" ]]; then
                filter_str="$f"
            else
                filter_str="$filter_str AND $f"
            fi
        done
        query="$query AND ($filter_str)"
    fi

    echo "$query"
}

# 通过 Zoekt API 搜索
search_api() {
    local query="$1"
    local encoded_query
    encoded_query=$(python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))" "$query")
    local url="${ZOEKT_HOST}/search?q=${encoded_query}&format=json&num=${NUM_RESULTS}"

    local response
    response=$(curl -s "$url" 2>/dev/null || true)

    echo "$response"
}

# 通过本地命令搜索
search_local() {
    local query="$1"

    if ! command -v zoekt &>/dev/null; then
        log_error "zoekt 命令未找到，且无法连接 Zoekt 服务"
        exit 1
    fi

    zoekt -index_dir "$ZOEKT_INDEX_DIR" "$query" 2>/dev/null | head -n "$((NUM_RESULTS * 3))" || true
}

# 格式化输出结果
format_results() {
    local response="$1"

    if $RAW_OUTPUT; then
        echo "$response"
        return
    fi

    if $JSON_OUTPUT; then
        if command -v python3 &>/dev/null; then
            python3 -c "import sys, json; d=json.load(sys.stdin); print(json.dumps(d, ensure_ascii=False, indent=2))" <<< "$response" 2>/dev/null || echo "$response"
        else
            echo "$response"
        fi
        return
    fi

    # 解析 Zoekt JSON API 响应 (GET /search?q=...&format=json 返回 result.FileMatches)
    if [[ -n "$response" ]]; then
        if command -v python3 &>/dev/null; then
            python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    files = data.get('result', {}).get('FileMatches', [])
    if not files:
        print('未找到匹配结果')
        sys.exit(0)

    print(f'\033[0;32m找到 {len(files)} 个文件:\033[0m')
    for f in files[:20]:  # 最多显示20个
        repo = f.get('Repo', 'unknown')
        fname = f.get('FileName', 'unknown')
        lang = f.get('Language', 'unknown')
        matches = f.get('Matches', [])
        print('\n' + '='*50)
        print(f'📁 {repo}/{fname}')
        print(f'   语言: {lang} | 匹配: {len(matches)} 处')
        for m in matches[:3]:  # 最多显示3处
            line_no = m.get('LineNum', 0)
            frags = m.get('Fragments', [])
            line_parts = []
            for frag in frags[:3]:
                pre = frag.get('Pre', '')
                match = frag.get('Match', '')
                post = frag.get('Post', '')
                line_parts.append(f'{pre}\033[1;33m{match}\033[0m{post}')
            line = ''.join(line_parts)[:200]
            print(f'   📌 L{line_no}: {line}')
        if len(matches) > 3:
            print(f'   ... 还有 {len(matches) - 3} 处匹配')
except Exception as e:
    print(f'解析错误: {e}')
    print(sys.stdin.read()[:500])
" <<< "$response"
        else
            echo "$response"
        fi
    else
        log_warn "未获取到结果"
    fi
}

# 检查服务是否可用
check_service() {
    if curl -s "${ZOEKT_HOST}/healthz" &>/dev/null || curl -s "${ZOEKT_HOST}/" &>/dev/null; then
        return 0
    fi
    return 1
}

# 临时启动本地 zoekt-webserver
start_local_server() {
    if ! command -v zoekt-webserver &>/dev/null; then
        if [[ -x "$HOME/go/bin/zoekt-webserver" ]]; then
            export PATH="$PATH:$HOME/go/bin"
        else
            log_error "zoekt-webserver 未安装"
            return 1
        fi
    fi

    zoekt-webserver -index "$ZOEKT_INDEX_DIR" -listen :6070 &>/dev/null &
    local pid=$!

    local max_wait=30
    local waited=0
    while ! check_service && [[ $waited -lt $max_wait ]]; do
        sleep 0.5
        waited=$((waited + 1))
        if ! kill -0 "$pid" 2>/dev/null; then
            log_error "zoekt-webserver 启动失败"
            return 1
        fi
    done

    if ! check_service; then
        kill "$pid" 2>/dev/null || true
        log_error "等待 zoekt-webserver 超时"
        return 1
    fi

    echo "$pid"
}

# 主流程
main() {
    if [[ -z "$QUERY" ]]; then
        log_error "请提供查询语句"
        show_help
        exit 1
    fi

    check_deps

    local final_query
    final_query="$(build_query)"

    log_info "查询: $final_query"
    log_info "服务: $ZOEKT_HOST"

    local local_pid=""

    if ! check_service; then
        log_info "Zoekt 服务未运行，临时启动中..."
        local_pid=$(start_local_server)
        if [[ -z "$local_pid" ]]; then
            exit 1
        fi
        log_success "服务已启动: $ZOEKT_HOST"
    fi

    # 确保临时服务在脚本退出时被清理
    cleanup_server() {
        if [[ -n "${local_pid:-}" ]]; then
            kill "$local_pid" 2>/dev/null || true
            log_info "临时服务已关闭"
        fi
    }
    trap cleanup_server EXIT

    local response=""
    response="$(search_api "$final_query")"

    # 检查是否返回了有效的 JSON 结果
    if [[ -n "$response" ]] && python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('result',{}).get('FileMatches') else 1)" <<< "$response" 2>/dev/null; then
        format_results "$response"
        # 后台延迟增量更新查询涉及的仓库
        trigger_delayed_update "$response"
    else
        log_warn "未找到匹配结果"
    fi
}

main "$@"
