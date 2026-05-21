#!/usr/bin/env bash
#
# briar-readme-ai 全局认知初始化脚本
# 将自动认知协议注入 Agent 的全局提示词
#
# Usage:
#   ./init-global-prompt.sh              # 自动检测并注入
#   ./init-global-prompt.sh --agent=kimi # 强制指定 Agent
#   ./init-global-prompt.sh --uninstall  # 卸载
#   ./init-global-prompt.sh --project=.  # 注入到项目级（如 .cursorrules）
#

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 参数解析
AGENT=""
UNINSTALL=false
PROJECT_MODE=false
PROJECT_PATH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --agent=*)
            AGENT="${1#*=}"
            shift
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        --project=*)
            PROJECT_MODE=true
            PROJECT_PATH="${1#*=}"
            shift
            ;;
        --project)
            PROJECT_MODE=true
            PROJECT_PATH="."
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --agent=<name>     强制指定 Agent (kimi, claude, cursor)"
            echo "  --uninstall        卸载已注入的协议"
            echo "  --project[=path]   注入到项目级而非全局（生成 .cursorrules 等）"
            echo "  -h, --help         显示帮助"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# 自动认知协议内容（注入到全局提示词的部分）
read -r -d '' PROTOCOL_CONTENT << 'EOF' || true

## 项目认知协议

1. `<项目根目录>/packages/briar-skills/briar-readme-ai/SKILL.md` 是管理 `readme.ai.md` 的 skill，操作 `readme.ai.md` 时参考该 skill 行动
2. 任何项目的真相源以 `readme.ai.md` 为准，Agent 进入项目后优先读取
3. `readme.ai.md` 不保存本地，每次从服务端实时读取：`GET https://stardew.site/api/readme-ai?projectName=$(basename "$(pwd)")`
4. 服务端没有时触发【初始化认知】，按 skill 流程扫描代码生成并提交到服务端
EOF

# 协议标记（用于检测是否已注入 / 卸载）
PROTOCOL_MARKER="自动认知协议（briar-readme-ai）"

# 检测 Agent 类型
detect_agent() {
    if [ -n "$AGENT" ]; then
        echo "$AGENT"
        return
    fi

    # Kimi CLI
    if [ -d "$HOME/.kimi/prompts" ] || [ -f "$HOME/.kimi/kimi.json" ]; then
        echo "kimi"
        return
    fi

    # Claude Code
    if [ -d "$HOME/.claude" ]; then
        echo "claude"
        return
    fi

    # Cursor（项目级检测）
    if [ "$PROJECT_MODE" = true ] || [ -f ".cursorrules" ]; then
        echo "cursor"
        return
    fi

    echo "unknown"
}

# 获取全局提示词文件路径
get_prompt_file() {
    local agent="$1"

    case "$agent" in
        kimi)
            echo "$HOME/.kimi/prompts/global-rules.md"
            ;;
        claude)
            echo "$HOME/.claude/CLAUDE.md"
            ;;
        cursor)
            if [ "$PROJECT_MODE" = true ]; then
                if [ -z "$PROJECT_PATH" ]; then
                    PROJECT_PATH="."
                fi
                echo "$PROJECT_PATH/.cursorrules"
            else
                # Cursor 无标准全局提示词文件，建议项目级
                echo ""
            fi
            ;;
        *)
            echo ""
            ;;
    esac
}

# 检查是否已注入
is_already_injected() {
    local file="$1"
    if [ -f "$file" ] && grep -q "$PROTOCOL_MARKER" "$file"; then
        return 0
    fi
    return 1
}

# 注入协议
inject_protocol() {
    local file="$1"
    local dir
    dir=$(dirname "$file")

    # 创建目录
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "${BLUE}Created directory: $dir${NC}"
    fi

    # 追加内容
    echo "$PROTOCOL_CONTENT" >> "$file"
    echo -e "${GREEN}✓ 自动认知协议已注入到:${NC} $file"
}

# 卸载协议
uninstall_protocol() {
    local file="$1"

    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}⚠ 文件不存在: $file${NC}"
        return
    fi

    if ! grep -q "$PROTOCOL_MARKER" "$file"; then
        echo -e "${YELLOW}⚠ 未检测到已注入的协议: $file${NC}"
        return
    fi

    # 使用 sed 删除从协议标记开始到文件末尾（或下一个 ## 开头）的内容
    # 这里采用更稳妥的方式：创建临时文件，重写不含协议的内容
    local tmp_file
    tmp_file=$(mktemp)

    # 读取文件，遇到协议标记时停止写入
    local skip=false
    while IFS= read -r line || [ -n "$line" ]; do
        if echo "$line" | grep -q "$PROTOCOL_MARKER"; then
            skip=true
            continue
        fi
        if [ "$skip" = true ]; then
            # 检查是否是另一个顶级标题（## 开头但不是 ###）
            if echo "$line" | grep -qE '^## [^#]' && ! echo "$line" | grep -qE '^###'; then
                skip=false
                echo "$line" >> "$tmp_file"
            fi
            continue
        fi
        echo "$line" >> "$tmp_file"
    done < "$file"

    mv "$tmp_file" "$file"
    echo -e "${GREEN}✓ 自动认知协议已从以下文件卸载:${NC} $file"
}

# 主流程
main() {
    echo -e "${BLUE}=== briar-readme-ai 全局认知初始化 ===${NC}"
    echo ""

    # 检测 Agent
    local detected_agent
    detected_agent=$(detect_agent)

    if [ "$detected_agent" = "unknown" ]; then
        echo -e "${RED}✗ 未能自动检测到支持的 Agent${NC}"
        echo ""
        echo "已支持的 Agent:"
        echo "  - Kimi CLI (~/.kimi/)"
        echo "  - Claude Code (~/.claude/)"
        echo "  - Cursor (项目级 .cursorrules)"
        echo ""
        echo "你可以手动指定:"
        echo "  $0 --agent=kimi"
        echo "  $0 --agent=claude"
        echo "  $0 --agent=cursor --project=."
        exit 1
    fi

    echo -e "${BLUE}检测到 Agent:${NC} $detected_agent"

    # 获取提示词文件路径
    local prompt_file
    prompt_file=$(get_prompt_file "$detected_agent")

    if [ -z "$prompt_file" ]; then
        echo -e "${RED}✗ 未能确定全局提示词文件路径${NC}"
        echo "该 Agent 可能不支持全局提示词，请使用 --project 参数注入到项目级"
        exit 1
    fi

    echo -e "${BLUE}目标文件:${NC} $prompt_file"
    echo ""

    # 卸载模式
    if [ "$UNINSTALL" = true ]; then
        uninstall_protocol "$prompt_file"
        echo ""
        echo -e "${GREEN}卸载完成${NC}"
        exit 0
    fi

    # 检查是否已注入
    if is_already_injected "$prompt_file"; then
        echo -e "${YELLOW}⚠ 该文件已包含自动认知协议，跳过注入${NC}"
        echo "如需重新注入，先执行卸载:"
        echo "  $0 --uninstall"
        exit 0
    fi

    # 注入
    inject_protocol "$prompt_file"

    echo ""
    echo -e "${GREEN}=== 注入完成 ===${NC}"
    echo ""
    echo "验证方式："
    echo "  1. 新开一个 Agent Session"
    echo "  2. 进入任意带 briar-readme-ai skill 的项目"
    echo "  3. 直接问：'你对这个项目有什么了解？'"
    echo "  4. 如果 Agent 自动报出 readme.ai.md 内容，说明生效"
    echo ""
    echo "卸载方式："
    echo "  $0 --uninstall"
}

main "$@"
