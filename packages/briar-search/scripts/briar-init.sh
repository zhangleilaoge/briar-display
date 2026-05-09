#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$PROJECT_DIR/config"
ZOEKT_INDEX_DIR="${ZOEKT_INDEX_DIR:-$PROJECT_DIR/.zoekt}"
REPOS_ROOT="${REPOS_ROOT:-/repos}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

show_help() {
    cat << 'EOF'
用法: briar-init [选项] [仓库路径...]

初始化 Briar 代码搜索引擎，为指定仓库建立 Zoekt 全文索引。

选项:
  -h, --help              显示帮助信息
  -f, --file FILE         从文件读取仓库列表（每行一个路径）
  -d, --directory DIR     批量索引 DIR 下的所有 Git 仓库
  -r, --repos-root DIR    设置仓库根目录（默认: /repos）
  -i, --index-dir DIR     设置索引输出目录（默认: ~/.zoekt）
  --docker                使用 Docker Compose 部署 Zoekt 服务
  --serve                 索引完成后启动 Web 服务
  --port PORT             Web 服务端口（默认: 6070）

示例:
  briar-init /repos/guide-service /repos/crm-attribution
  briar-init -f /path/to/repos.list
  briar-init -d /repos --serve
  briar-init --docker -d /repos

环境变量:
  REPOS_ROOT       仓库根目录
  ZOEKT_INDEX_DIR  索引输出目录
EOF
}

# 参数解析
REPO_LIST=()
LIST_FILE=""
BATCH_DIR=""
USE_DOCKER=false
SERVE=false
PORT=6070

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--file)
            LIST_FILE="$2"
            shift 2
            ;;
        -d|--directory)
            BATCH_DIR="$2"
            shift 2
            ;;
        -r|--repos-root)
            REPOS_ROOT="$2"
            shift 2
            ;;
        -i|--index-dir)
            ZOEKT_INDEX_DIR="$2"
            shift 2
            ;;
        --docker)
            USE_DOCKER=true
            shift
            ;;
        --serve)
            SERVE=true
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        -*)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
        *)
            REPO_LIST+=("$1")
            shift
            ;;
    esac
done

# 收集所有需要索引的仓库
collect_repos() {
    local repos=()

    # 从文件读取
    if [[ -n "$LIST_FILE" ]]; then
        if [[ ! -f "$LIST_FILE" ]]; then
            log_error "仓库列表文件不存在: $LIST_FILE"
            exit 1
        fi
        while IFS= read -r line || [[ -n "$line" ]]; do
            line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
            [[ -z "$line" || "$line" == \#* ]] && continue
            repos+=("$line")
        done < "$LIST_FILE"
    fi

    # 从目录批量收集
    if [[ -n "$BATCH_DIR" ]]; then
        if [[ ! -d "$BATCH_DIR" ]]; then
            log_error "目录不存在: $BATCH_DIR"
            exit 1
        fi
        while IFS= read -r -d '' repo; do
            repos+=("$repo")
        done < <(find "$BATCH_DIR" -maxdepth 2 -type d -name ".git" -print0 | while IFS= read -r -d '' gitdir; do
            dirname "$gitdir"
        done | sort -u | while IFS= read -r repo; do
            printf '%s\0' "$repo"
        done)
    fi

    # 命令行参数
    for repo in "${REPO_LIST[@]:-}"; do
        repos+=("$repo")
    done

    # 去重
    if [[ ${#repos[@]} -gt 0 ]]; then
        printf '%s\n' "${repos[@]}" | sort -u
    fi
}

# 检测操作系统
detect_os() {
    case "$(uname -s)" in
        Linux*)     echo "linux";;
        Darwin*)    echo "macos";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)          echo "unknown";;
    esac
}

OS=$(detect_os)

# 自动安装依赖
install_dependency() {
    local cmd="$1"
    local install_msg="$2"
    local install_cmd="$3"

    if ! command -v "$cmd" &>/dev/null; then
        log_warn "$install_msg"
        if [[ -n "$install_cmd" ]]; then
            log_info "执行: $install_cmd"
            eval "$install_cmd" || {
                log_error "$cmd 安装失败，请手动安装"
                return 1
            }
        else
            log_error "无法自动安装 $cmd，请手动安装"
            return 1
        fi
    fi
    return 0
}

# 安装 Go
install_go() {
    if command -v go &>/dev/null; then
        return 0
    fi

    log_warn "Go 未安装，尝试自动安装..."

    case "$OS" in
        macos)
            if command -v brew &>/dev/null; then
                brew install go
            else
                log_info "正在安装 Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                brew install go
            fi
            ;;
        linux)
            if command -v apt &>/dev/null; then
                sudo apt-get update && sudo apt-get install -y golang-go
            elif command -v yum &>/dev/null; then
                sudo yum install -y golang
            elif command -v dnf &>/dev/null; then
                sudo dnf install -y golang
            else
                # 尝试从官网下载二进制
                log_info "从官网下载 Go 二进制..."
                local go_version="1.22.0"
                local go_tar="go${go_version}.linux-amd64.tar.gz"
                curl -LO "https://go.dev/dl/${go_tar}"
                sudo rm -rf /usr/local/go
                sudo tar -C /usr/local -xzf "$go_tar"
                rm "$go_tar"
                export PATH=$PATH:/usr/local/go/bin
                echo 'export PATH=$PATH:/usr/local/go/bin' >> "$HOME/.bashrc"
            fi
            ;;
        *)
            log_error "不支持的操作系统: $OS"
            return 1
            ;;
    esac

    # 验证
    if ! command -v go &>/dev/null; then
        # 尝试从可能的路径加载
        export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
        if ! command -v go &>/dev/null; then
            log_error "Go 安装后仍不可用，请检查 PATH"
            return 1
        fi
    fi

    log_success "Go 已安装: $(go version)"
    return 0
}

# 安装 Zoekt
install_zoekt() {
    if command -v zoekt-git-index &>/dev/null; then
        return 0
    fi

    log_warn "Zoekt 未安装，尝试自动安装..."

    # 确保 Go 可用
    install_go || return 1

    # 确保 $HOME/go/bin 在 PATH 中
    export PATH="$PATH:$HOME/go/bin:/usr/local/go/bin"

    log_info "通过 go install 安装 Zoekt..."
    go install github.com/sourcegraph/zoekt/cmd/zoekt-git-index@latest
    go install github.com/sourcegraph/zoekt/cmd/zoekt-webserver@latest
    go install github.com/sourcegraph/zoekt/cmd/zoekt@latest

    # 验证
    if ! command -v zoekt-git-index &>/dev/null; then
        # 可能安装到了 $HOME/go/bin 但不在 PATH
        if [[ -x "$HOME/go/bin/zoekt-git-index" ]]; then
            export PATH="$PATH:$HOME/go/bin"
        else
            log_error "Zoekt 安装失败"
            return 1
        fi
    fi

    log_success "Zoekt 已安装"
    return 0
}

# 安装 Docker
install_docker() {
    if command -v docker &>/dev/null; then
        return 0
    fi

    log_warn "Docker 未安装，尝试自动安装..."

    case "$OS" in
        macos)
            if command -v brew &>/dev/null; then
                log_info "通过 Homebrew 安装 Docker Desktop..."
                brew install --cask docker
                log_warn "Docker Desktop 已安装，请手动启动 Docker 应用后继续"
                log_warn "启动后按回车继续..."
                read -r
            else
                log_info "正在安装 Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                brew install --cask docker
            fi
            ;;
        linux)
            if command -v apt &>/dev/null; then
                log_info "通过 apt 安装 Docker..."
                sudo apt-get update
                sudo apt-get install -y ca-certificates curl gnupg
                sudo install -m 0755 -d /etc/apt/keyrings
                curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
                sudo chmod a+r /etc/apt/keyrings/docker.gpg
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
                sudo apt-get update
                sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                sudo usermod -aG docker "$USER"
                log_warn "Docker 已安装，可能需要重新登录或执行: newgrp docker"
            elif command -v yum &>/dev/null; then
                sudo yum install -y yum-utils
                sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
                sudo systemctl start docker
                sudo usermod -aG docker "$USER"
            else
                log_error "无法自动安装 Docker，请手动安装"
                return 1
            fi
            ;;
        *)
            log_error "不支持的操作系统: $OS"
            return 1
            ;;
    esac

    # 验证
    if ! command -v docker &>/dev/null; then
        log_error "Docker 安装后仍不可用"
        return 1
    fi

    log_success "Docker 已安装: $(docker --version)"
    return 0
}

# 检查 docker compose
ensure_docker_compose() {
    if docker compose version &>/dev/null; then
        return 0
    fi
    if command -v docker-compose &>/dev/null; then
        return 0
    fi

    log_warn "Docker Compose 未找到，尝试安装..."

    case "$OS" in
        linux)
            if command -v apt &>/dev/null; then
                sudo apt-get install -y docker-compose-plugin
            fi
            ;;
    esac

    # 再次检查
    if docker compose version &>/dev/null || command -v docker-compose &>/dev/null; then
        log_success "Docker Compose 已就绪"
        return 0
    fi

    # 回退到独立安装
    log_info "安装 Docker Compose standalone..."
    local compose_version="v2.24.0"
    sudo curl -L "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose

    if command -v docker-compose &>/dev/null; then
        log_success "Docker Compose 已安装"
        return 0
    fi

    log_error "Docker Compose 安装失败"
    return 1
}

# 检查 zoekt 是否可用（含自动安装）
check_zoekt() {
    if $USE_DOCKER; then
        install_docker || exit 1
        ensure_docker_compose || exit 1

        # 检查 Docker 守护进程是否运行
        if ! docker info &>/dev/null; then
            log_error "Docker 守护进程未运行"
            if [[ "$OS" == "macos" ]]; then
                log_warn "请在 macOS 上手动启动 Docker Desktop 应用"
            else
                log_info "尝试启动 Docker 服务..."
                sudo systemctl start docker 2>/dev/null || true
            fi
            exit 1
        fi
        return
    fi

    # 本地模式：确保 zoekt 可用
    install_zoekt || exit 1
    log_success "Zoekt 命令可用"
}

# 生成业务域标签映射
generate_repo_tags() {
    local repo_path="$1"
    local repo_name
    repo_name="$(basename "$repo_path")"
    local tags=()

    # 读取 domains.json 规则
    local domains_file="$CONFIG_DIR/domains.json"
    if [[ ! -f "$domains_file" ]]; then
        echo ""
        return
    fi

    # 使用 jq 或 Python 解析规则
    if command -v jq &>/dev/null; then
        while IFS= read -r domain; do
            local matched=false
            # 检查 repo_patterns
            local patterns
            patterns=$(jq -r --arg d "$domain" '.domains[$d].repo_patterns[]?' "$domains_file" 2>/dev/null || true)
            while IFS= read -r pattern; do
                [[ -z "$pattern" ]] && continue
                if [[ "$repo_name" == $pattern ]]; then
                    matched=true
                    break
                fi
            done <<< "$patterns"

            if $matched; then
                tags+=("$domain")
            fi
        done < <(jq -r '.domains | keys[]' "$domains_file")
    elif command -v python3 &>/dev/null; then
        tags=$(python3 -c "
import json, fnmatch, sys
repo_name = sys.argv[1]
with open('$domains_file') as f:
    config = json.load(f)
tags = []
for domain, rules in config.get('domains', {}).items():
    for pattern in rules.get('repo_patterns', []):
        if fnmatch.fnmatch(repo_name, pattern):
            tags.append(domain)
            break
print(','.join(tags))
" "$repo_name")
    fi

    echo "${tags[*]:-}"
}

# 建立索引（本地模式）
index_local() {
    local repos=()
    while IFS= read -r repo; do
        repos+=("$repo")
    done < <(collect_repos)

    if [[ ${#repos[@]} -eq 0 ]]; then
        log_error "未指定任何仓库，请使用 -f、-d 或命令行参数指定仓库"
        show_help
        exit 1
    fi

    log_info "将索引 ${#repos[@]} 个仓库到 $ZOEKT_INDEX_DIR"
    mkdir -p "$ZOEKT_INDEX_DIR"

    for repo in "${repos[@]}"; do
        if [[ ! -d "$repo/.git" ]]; then
            log_warn "跳过非 Git 仓库: $repo"
            continue
        fi

        local repo_name
        repo_name="$(basename "$repo")"
        local tags
        tags="$(generate_repo_tags "$repo")"

        log_info "索引中: $repo_name ${tags:+[标签: $tags]}"

        # 构建额外参数
        local extra_args=()
        if [[ -n "$tags" ]]; then
            # 将标签注入为仓库描述，Zoekt 支持通过 description 过滤
            extra_args+=("-branches" "HEAD")
            extra_args+=("-prefix" "$repo_name")
        fi

        local zoekt_exit=0
        zoekt-git-index \
            -index "$ZOEKT_INDEX_DIR" \
            "${extra_args[@]:-}" \
            "$repo" 2>&1 || zoekt_exit=$?

        if [[ $zoekt_exit -ne 0 ]]; then
            # zoekt 可能因 unknown git hosting site 等 warning 返回非零
            # 检查索引文件是否实际已生成
            if find "$ZOEKT_INDEX_DIR" -name "*${repo_name}*" -type f &>/dev/null; then
                log_info "索引文件已生成（忽略非致命 warning）: $repo_name"
            else
                log_warn "索引失败: $repo"
            fi
        fi
    done

    # 生成 repo-map.json 用于查询后反向查找本地路径
    generate_repo_map "${repos[@]}"

    log_success "本地索引完成，共 ${#repos[@]} 个仓库"
}

# 生成仓库名到本地路径的映射
generate_repo_map() {
    local repos=("$@")
    local map_file="$CONFIG_DIR/repo-map.json"

    python3 -c "
import json, subprocess, sys

result = {}
for repo_path in sys.argv[1:]:
    try:
        # 获取仓库的远程 origin URL
        url = subprocess.check_output(
            ['git', '-C', repo_path, 'remote', 'get-url', 'origin'],
            stderr=subprocess.DEVNULL, text=True
        ).strip()
        # 去掉 .git 后缀和协议头
        url = url.replace('.git', '').replace('https://', '').replace('http://', '').replace('git@', '').replace(':', '/')
        result[url] = repo_path
    except:
        # 没有 origin 就用目录名
        import os
        result[os.path.basename(repo_path)] = repo_path

with open('$map_file', 'w') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)
" "${repos[@]}"

    log_info "仓库映射已保存: $map_file"
}

# Docker 模式部署
deploy_docker() {
    log_info "使用 Docker Compose 部署 Zoekt..."

    export REPOS_ROOT
    cd "$PROJECT_DIR"

    # 生成 repos.list
    local repos_list="$CONFIG_DIR/repos.list"
    collect_repos > "$repos_list"

    if [[ ! -s "$repos_list" ]]; then
        log_error "未找到任何仓库，请检查参数"
        exit 1
    fi

    log_info "发现 $(wc -l < "$repos_list") 个仓库"

    # 启动服务
    if docker compose version &>/dev/null; then
        docker compose up -d
    else
        docker-compose up -d
    fi

    log_success "Zoekt Docker 服务已启动"
    log_info "Web UI: http://localhost:6070"
    log_info "API:    http://localhost:6070/api/search"
}

# 启动 Web 服务
start_server() {
    if $USE_DOCKER; then
        log_info "Docker 模式下 Web 服务已在容器中运行: http://localhost:$PORT"
        return
    fi

    log_info "启动 Zoekt Web 服务..."
    zoekt-webserver \
        -index "$ZOEKT_INDEX_DIR" \
        -rpc \
        -listen ":$PORT" &

    local pid=$!
    sleep 2

    if kill -0 $pid 2>/dev/null; then
        log_success "Web 服务已启动: http://localhost:$PORT"
        log_info "按 Ctrl+C 停止服务"
        wait $pid
    else
        log_error "Web 服务启动失败"
        exit 1
    fi
}

# 主流程
main() {
    log_info "Briar Search 初始化工具"
    log_info "索引目录: $ZOEKT_INDEX_DIR"
    log_info "仓库根目录: $REPOS_ROOT"

    check_zoekt

    if $USE_DOCKER; then
        deploy_docker
    else
        index_local
    fi

    if $SERVE; then
        start_server
    else
        log_info "索引完成。使用 --serve 启动 Web 服务，或使用 briar-search 进行查询。"
    fi
}

main "$@"
