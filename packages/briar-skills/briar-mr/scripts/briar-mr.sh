#!/bin/bash
# briar-mr.sh - GitLab MR 全能工具（总入口）
# 根据 action 路由到对应的原子脚本。
#
# Usage:
#   ./briar-mr.sh create  <domain> <project_path> <source_branch> <target_branch> <title> [description]
#   ./briar-mr.sh fetch         <domain> <project_path> <mr_iid>
#   ./briar-mr.sh comment       <domain> <project_path> <mr_iid> <body>
#   ./briar-mr.sh reply         <domain> <project_path> <mr_iid> <discussion_id> <body>
#   ./briar-mr.sh diff          <domain> <project_path> <mr_iid>
#   ./briar-mr.sh find          <domain> <project_path> <source_branch>
#   ./briar-mr.sh post-notes    <domain> <project_path> <mr_iid> <comments.json>
#   ./briar-mr.sh pipeline      <domain> <project_path> <mr_iid>
#   ./briar-mr.sh pending       [domain] [days]
#
# 注意：review/pipeline 所需 worktree 用 git worktree 原生命令创建/清理。
#
# 也可以直接调用原子脚本：
#   ./briar-mr-create.sh   ...
#   ./briar-mr-review.sh   ...
#   ./briar-mr-pipeline.sh ...
#   ./briar-mr-pending.sh  ...

set -e

# --- 统一加载 .env 配置 ---
load_env() {
	# 1. 全局配置
	local global_env="$HOME/.config/briar-skills/.env"
	if [ -f "$global_env" ]; then
		# shellcheck source=/dev/null
		set -a; source "$global_env"; set +a
	fi

	# 2. 项目内 .env：优先 BRIAR_PROJECT_ENV，否则尝试当前 git 仓库根目录
	local project_env=""
	if [ -n "$BRIAR_PROJECT_ENV" ]; then
		project_env="$BRIAR_PROJECT_ENV"
	else
		project_env=$(git rev-parse --show-toplevel 2>/dev/null || true)
		if [ -n "$project_env" ]; then
			project_env="$project_env/.env"
		fi
	fi
	if [ -n "$project_env" ] && [ -f "$project_env" ]; then
		# shellcheck source=/dev/null
		set -a; source "$project_env"; set +a
	fi
}
load_env

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACTION="${1}"

show_usage() {
	echo "Usage:"
	echo "  $0 create   <domain> <project_path> <source_branch> <target_branch> <title> [description]"
	echo "  $0 fetch         <domain> <project_path> <mr_iid>"
	echo "  $0 comment       <domain> <project_path> <mr_iid> <comment_body>"
	echo "  $0 reply         <domain> <project_path> <mr_iid> <discussion_id> <reply_body>"
	echo "  $0 diff          <domain> <project_path> <mr_iid>"
	echo "  $0 find          <domain> <project_path> <source_branch>"
	echo "  $0 post-notes    <domain> <project_path> <mr_iid> <comments.json>"
	echo "  $0 pipeline      <domain> <project_path> <mr_iid>"
	echo "  $0 pending       [domain] [days]"
	echo ""
	echo "Examples:"
	echo "  $0 create   gitlab.qima-inc.com wsc-node/wsc-pc-channel feat/foo master 'feat: foo' 'Details...'"
	echo "  $0 fetch         gitlab.qima-inc.com wsc-node/wsc-pc-channel 932"
	echo "  $0 comment       gitlab.qima-inc.com wsc-node/wsc-pc-channel 932 'LGTM!'"
	echo "  $0 reply         gitlab.qima-inc.com wsc-node/wsc-pc-channel 932 abc123 '已修复 ✅'"
	echo "  $0 find          gitlab.qima-inc.com wsc-node/wsc-pc-channel feat/foo"
	echo "  $0 post-notes    gitlab.qima-inc.com wsc-node/wsc-pc-channel 932 comments.json"
	echo "  $0 pipeline      gitlab.qima-inc.com fe/scrm-mono 4849"
	echo "  $0 pending       gitlab.qima-inc.com 7"
}

if [ -z "$ACTION" ] || [ "$ACTION" = "-h" ] || [ "$ACTION" = "--help" ]; then
	show_usage
	exit 0
fi

# pending 不需要 project_path，特殊处理参数偏移
if [ "$ACTION" = "pending" ]; then
	shift
	exec "${SCRIPT_DIR}/briar-mr-pending.sh" "$@"
fi

# 其余命令需要至少 domain + project_path
if [ $# -lt 3 ]; then
	show_usage
	exit 1
fi

DOMAIN="${2}"
PROJECT_PATH="${3}"

shift 3

case "$ACTION" in
	create)
		exec "${SCRIPT_DIR}/briar-mr-create.sh" "$DOMAIN" "$PROJECT_PATH" "$@"
		;;
	fetch|comment|reply|diff|find|post-notes)
		exec "${SCRIPT_DIR}/briar-mr-review.sh" "$ACTION" "$DOMAIN" "$PROJECT_PATH" "$@"
		;;
	pipeline)
		exec "${SCRIPT_DIR}/briar-mr-pipeline.sh" "$DOMAIN" "$PROJECT_PATH" "$@"
		;;
	*)
		echo "Unknown action: $ACTION"
		show_usage
		exit 1
		;;
esac
