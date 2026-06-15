#!/bin/bash
# briar-repo.sh - 仓库管理工具
# Usage:
#   ./briar-repo.sh pull          <repo-name> [base_dir] [domain]
#   ./briar-repo.sh update        <repo-name> [base_dir]
#   ./briar-repo.sh clean         <repo-name> [base_dir]
#   ./briar-repo.sh worktree add     <repo-name> <branch> [base_dir]
#   ./briar-repo.sh worktree remove  <repo-name> <branch> [base_dir]
#   ./briar-repo.sh worktree list    <repo-name> [base_dir]
#   ./briar-repo.sh worktree clean   <repo-name> [base_dir]
#
# Default base_dir by domain:
#   gitlab.qima-inc.com / gitlab.com -> $HOME/Documents/gitlab
#   github.com                         -> $HOME/Documents/github
#   others                             -> $HOME/projects

set -e

# --- 根据域名推断默认本地父目录 ---
get_default_base_dir() {
	local domain="${1:-}"
	case "$domain" in
		gitlab.qima-inc.com | gitlab.com)
			echo "$HOME/Documents/gitlab"
			;;
		github.com)
			echo "$HOME/Documents/github"
			;;
		*)
			echo "$HOME/projects"
			;;
	esac
}

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

ACTION="${1}"

show_usage() {
	echo "Usage:"
	echo "  $0 pull          <repo-name> [base_dir] [domain]"
	echo "  $0 update        <repo-name> [base_dir]"
	echo "  $0 clean         <repo-name> [base_dir]"
	echo "  $0 worktree add     <repo-name> <branch> [base_dir]"
	echo "  $0 worktree remove  <repo-name> <branch> [base_dir]"
	echo "  $0 worktree list    <repo-name> [base_dir]"
	echo "  $0 worktree clean   <repo-name> [base_dir]"
	echo ""
	echo "Examples:"
	echo "  $0 pull retail-app-member"
	echo "  $0 pull react github.com"
	echo "  $0 update retail-app-member"
	echo "  $0 clean retail-app-member"
	echo "  $0 worktree add retail-app-member feat/foo"
	echo "  $0 worktree remove retail-app-member feat/foo"
	echo "  $0 worktree list retail-app-member"
	echo "  $0 worktree clean retail-app-member"
	echo ""
	echo "Default base_dir:"
	echo "  GitLab (gitlab.qima-inc.com / gitlab.com) -> $HOME/Documents/gitlab"
	echo "  GitHub (github.com)                         -> $HOME/Documents/github"
	echo "  Others                                      -> $HOME/projects"
}

if [ -z "$ACTION" ] || [ "$ACTION" = "-h" ] || [ "$ACTION" = "--help" ]; then
	show_usage
	exit 0
fi

# --- 参数解析 ---
if [ "$ACTION" = "worktree" ]; then
	SUBCMD="${2}"
	REPO_NAME="${3}"
	if [ "$SUBCMD" = "add" ] || [ "$SUBCMD" = "remove" ]; then
		BRANCH="${4}"
		BASE_DIR="${5:-${BRIAR_REPO_BASE_DIR:-}}"
	else
		BASE_DIR="${4:-${BRIAR_REPO_BASE_DIR:-}}"
	fi
	# worktree 必须有已存在的仓库，这里无法推断 domain，沿用旧默认
	if [ -z "$BASE_DIR" ]; then
		BASE_DIR="$HOME/projects"
	fi
else
	REPO_NAME="${2}"
	ARG3="${3:-}"
	ARG4="${4:-}"

	# 智能识别 domain：第三个参数如果是已知域名，则视为 domain
	case "$ARG3" in
		gitlab.qima-inc.com | gitlab.com | github.com)
			DOMAIN="$ARG3"
			BASE_DIR="${BRIAR_REPO_BASE_DIR:-$(get_default_base_dir "$DOMAIN")}"
			;;
		*)
			DOMAIN="${ARG4:-gitlab.qima-inc.com}"
			BASE_DIR="${ARG3:-${BRIAR_REPO_BASE_DIR:-$(get_default_base_dir "$DOMAIN")}}"
			;;
	esac
fi

LOCAL_PATH="${BASE_DIR}/${REPO_NAME}"

if [ -z "$REPO_NAME" ]; then
	show_usage
	exit 1
fi

# --- pull: 拉取仓库 ---
if [ "$ACTION" = "pull" ]; then
	# 1. 检查本地是否已存在
	if [ -d "$LOCAL_PATH/.git" ]; then
		echo "本地已有该仓库：$LOCAL_PATH"
		REMOTE_URL=$(cd "$LOCAL_PATH" && git remote get-url origin 2>/dev/null || echo "unknown")
		echo "远程地址：$REMOTE_URL"
		echo "如需更新请执行：$0 update $REPO_NAME $BASE_DIR"
		exit 0
	fi

	# 2. 根据域名选择搜索方式
	case "$DOMAIN" in
		github.com)
			# GitHub
			if [ -z "$GITHUB_TOKEN" ]; then
				# 未设置 GITHUB_TOKEN 时尝试从 briar-assets 读取
				BRIAR_ASSETS_GITHUB_ENV="$HOME/Documents/github/briar-display/briar-assets/briar/.env"
				if [ -f "$BRIAR_ASSETS_GITHUB_ENV" ]; then
					GITHUB_TOKEN=$(grep '^BRIAR_GITHUB_TOKEN=' "$BRIAR_ASSETS_GITHUB_ENV" | cut -d= -f2-)
				fi
			fi

			AUTH_HEADER=""
			if [ -n "$GITHUB_TOKEN" ]; then
				AUTH_HEADER="Authorization: token $GITHUB_TOKEN"
			fi

			ENCODED_NAME=$(echo "$REPO_NAME" | sed 's/ /%20/g')
			if [ -n "$AUTH_HEADER" ]; then
				SEARCH_RESULT=$(curl -s -H "$AUTH_HEADER" \
					"https://api.github.com/search/repositories?q=${ENCODED_NAME}&per_page=20")
			else
				SEARCH_RESULT=$(curl -s \
					"https://api.github.com/search/repositories?q=${ENCODED_NAME}&per_page=20")
			fi

			MATCHES=$(echo "$SEARCH_RESULT" | jq --arg name "$REPO_NAME" '[.items // [] | .[] | select(.name == $name)]')
			COUNT=$(echo "$MATCHES" | jq 'length')

			if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
				echo "❌ 未在 GitHub 找到名为 \"$REPO_NAME\" 的仓库"
				exit 1
			elif [ "$COUNT" = "1" ]; then
				SELECTED=$(echo "$MATCHES" | jq '.[0]')
			else
				echo "发现多个同名仓库，请指定完整路径（如 owner/repo）："
				echo "$MATCHES" | jq -r '.[] | "  - \(.full_name) (\(.html_url))"'
				exit 1
			fi

			PROJECT_PATH=$(echo "$SELECTED" | jq -r '.full_name')
			SSH_URL=$(echo "$SELECTED" | jq -r '.ssh_url')
			WEB_URL=$(echo "$SELECTED" | jq -r '.html_url')
			;;

		gitlab.qima-inc.com | gitlab.com | *)
			# GitLab（默认）
			if [ -z "$GITLAB_TOKEN" ]; then
				echo "Error: GITLAB_TOKEN is not set."
				exit 1
			fi

			ENCODED_NAME=$(echo "$REPO_NAME" | sed 's/ /%20/g')
			SEARCH_RESULT=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
				"https://${DOMAIN}/api/v4/projects?search=${ENCODED_NAME}&per_page=20")

			MATCHES=$(echo "$SEARCH_RESULT" | jq --arg name "$REPO_NAME" '[.[] | select(.name == $name)]')
			COUNT=$(echo "$MATCHES" | jq 'length')

			if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
				echo "❌ 未在 GitLab 找到名为 \"$REPO_NAME\" 的仓库"
				exit 1
			elif [ "$COUNT" = "1" ]; then
				SELECTED=$(echo "$MATCHES" | jq '.[0]')
			else
				PREFERRED=$(echo "$MATCHES" | jq '[.[] | select(.path_with_namespace | startswith("wsc-node/"))] | .[0] // empty')
				if [ -n "$PREFERRED" ] && [ "$PREFERRED" != "null" ]; then
					SELECTED="$PREFERRED"
					echo "发现多个同名仓库，自动选择正式仓库：$(echo "$SELECTED" | jq -r '.path_with_namespace')"
				else
					echo "发现多个同名仓库，请指定完整路径："
					echo "$MATCHES" | jq -r '.[] | "  - \(.path_with_namespace) (\(.web_url))"'
					exit 1
				fi
			fi

			PROJECT_PATH=$(echo "$SELECTED" | jq -r '.path_with_namespace')
			SSH_URL=$(echo "$SELECTED" | jq -r '.ssh_url_to_repo')
			WEB_URL=$(echo "$SELECTED" | jq -r '.web_url')
			;;
	esac

	echo ""
	echo "📦 准备克隆 $PROJECT_PATH"
	echo "   URL: $SSH_URL"
	echo "   目标: $LOCAL_PATH"
	echo ""

	# 3. 执行克隆
	git clone "$SSH_URL" "$LOCAL_PATH"

	echo ""
	echo "✅ 克隆完成：$LOCAL_PATH"
	echo "   Web: $WEB_URL"
	exit 0
fi

# --- 通用检查：后续命令都需要本地仓库存在 ---
if [ ! -d "$LOCAL_PATH/.git" ]; then
	echo "Error: $LOCAL_PATH is not a git repository."
	echo "请先执行：$0 pull $REPO_NAME"
	exit 1
fi

REPO_NAME_BASENAME=$(basename "$LOCAL_PATH")

# --- update: stash + fetch --all + pull 所有本地分支 ---
if [ "$ACTION" = "update" ]; then
	cd "$LOCAL_PATH"

	CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

	# 1. stash
	if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
		echo "📦 Stashing changes..."
		git stash push -m "briar-repo auto-stash $(date +%s)"
	else
		echo "📦 No local changes to stash."
	fi

	# 2. fetch all
	echo "📦 Fetching all remotes..."
	git fetch --all

	# 3. pull 每个有 upstream 的本地分支
	echo "📦 Pulling tracked branches..."
	for branch in $(git branch --format='%(refname:short)'); do
		upstream=$(git rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null || true)
		if [ -n "$upstream" ]; then
			git checkout "$branch" >/dev/null 2>&1
			if git pull origin "$branch" >/dev/null 2>&1; then
				echo "  ✅ $branch"
			else
				echo "  ⚠️  $branch (skipped or diverged)"
			fi
		fi
	done

	# 回到原来的分支
	git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
	echo ""
	echo "✅ Update complete: $LOCAL_PATH"
	exit 0
fi

# --- clean: 删除所有 worktree + update ---
if [ "$ACTION" = "clean" ]; then
	cd "$LOCAL_PATH"

	# 1. 删除所有 worktree
	WT_COUNT=$(git worktree list --porcelain | grep -c '^worktree ' || true)
	if [ "$WT_COUNT" -gt 1 ] 2>/dev/null; then
		echo "📦 Removing all worktrees..."
		for wt in $(git worktree list --porcelain | grep '^worktree ' | tail -n +2 | cut -d' ' -f2-); do
			if [ -d "$wt" ]; then
				cd "$wt"
				if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
					echo "  Stashing changes in $wt..."
					git stash push -m "briar-repo auto-stash $(date +%s)"
				fi
				cd "$LOCAL_PATH"
				git worktree remove "$wt" 2>/dev/null || true
				if [ -d "$wt" ]; then
					rm -rf "$wt"
				fi
			fi
		done
		git worktree prune
		echo "  ✅ All worktrees removed."
	else
		echo "📦 No worktrees to remove."
	fi

	# 2. update
	cd "$LOCAL_PATH"
	CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

	if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
		echo "📦 Stashing changes..."
		git stash push -m "briar-repo auto-stash $(date +%s)"
	fi

	echo "📦 Fetching all remotes..."
	git fetch --all

	echo "📦 Pulling tracked branches..."
	for branch in $(git branch --format='%(refname:short)'); do
		upstream=$(git rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null || true)
		if [ -n "$upstream" ]; then
			git checkout "$branch" >/dev/null 2>&1
			if git pull origin "$branch" >/dev/null 2>&1; then
				echo "  ✅ $branch"
			else
				echo "  ⚠️  $branch (skipped or diverged)"
			fi
		fi
	done

	git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
	echo ""
	echo "✅ Clean complete: $LOCAL_PATH"
	exit 0
fi

# --- worktree: worktree 管理 ---
if [ "$ACTION" = "worktree" ]; then
	if [ -z "$SUBCMD" ]; then
		show_usage
		exit 1
	fi

	# 计算 worktree 路径：仓库同级目录 / 仓库名-分支名
	get_wt_path() {
		local b="${1:-$BRANCH}"
		local wt_name="${REPO_NAME_BASENAME}-$(echo "$b" | sed 's/\//-/g')"
		echo "$(cd "$LOCAL_PATH/.." && pwd)/${wt_name}"
	}

	# --- worktree add ---
	if [ "$SUBCMD" = "add" ]; then
		if [ -z "$BRANCH" ]; then
			echo "Error: branch is required for 'worktree add'."
			exit 1
		fi

		WT_PATH=$(get_wt_path)
		cd "$LOCAL_PATH"

		# 已存在则复用
		if [ -d "$WT_PATH" ]; then
			echo "Worktree already exists at $WT_PATH"
			cd "$WT_PATH"
			if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
				echo "Stashing existing changes..."
				git stash push -m "briar-repo auto-stash $(date +%s)"
			fi
			git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" origin/"$BRANCH" 2>/dev/null || true
			echo "$WT_PATH"
			exit 0
		fi

		# 确保远程分支已获取
		git fetch origin "$BRANCH" 2>/dev/null || true

		# 创建 worktree
		git worktree add "$WT_PATH" "$BRANCH" 2>/dev/null || git worktree add -b "$BRANCH" "$WT_PATH" origin/"$BRANCH"

		echo "Worktree created: $WT_PATH"
		echo "$WT_PATH"
		exit 0
	fi

	# --- worktree remove ---
	if [ "$SUBCMD" = "remove" ]; then
		if [ -z "$BRANCH" ]; then
			echo "Error: branch is required for 'worktree remove'."
			exit 1
		fi

		WT_PATH=$(get_wt_path)
		cd "$LOCAL_PATH"

		if [ ! -d "$WT_PATH" ]; then
			echo "Error: Worktree not found: $WT_PATH"
			exit 1
		fi

		cd "$WT_PATH"
		if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
			echo "Stashing uncommitted changes..."
			git stash push -m "briar-repo auto-stash $(date +%s)"
		fi
		cd "$LOCAL_PATH"

		git worktree remove "$WT_PATH" 2>/dev/null || true
		if [ -d "$WT_PATH" ]; then
			rm -rf "$WT_PATH"
			git worktree prune
		fi

		echo "Worktree removed: $WT_PATH"
		exit 0
	fi

	# --- worktree list ---
	if [ "$SUBCMD" = "list" ]; then
		cd "$LOCAL_PATH"
		echo "=== Worktrees for $REPO_NAME ==="
		git worktree list
		exit 0
	fi

	# --- worktree clean ---
	if [ "$SUBCMD" = "clean" ]; then
		cd "$LOCAL_PATH"
		WT_COUNT=$(git worktree list --porcelain | grep -c '^worktree ' || true)
		if [ "$WT_COUNT" -le 1 ] 2>/dev/null; then
			echo "No worktrees to remove."
			exit 0
		fi

		echo "Removing all worktrees..."
		for wt in $(git worktree list --porcelain | grep '^worktree ' | tail -n +2 | cut -d' ' -f2-); do
			if [ -d "$wt" ]; then
				cd "$wt"
				if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
					echo "  Stashing changes in $wt..."
					git stash push -m "briar-repo auto-stash $(date +%s)"
				fi
				cd "$LOCAL_PATH"
				git worktree remove "$wt" 2>/dev/null || true
				if [ -d "$wt" ]; then
					rm -rf "$wt"
				fi
			fi
		done
		git worktree prune
		echo "All worktrees cleaned."
		exit 0
	fi

	echo "Unknown worktree subcommand: $SUBCMD"
	show_usage
	exit 1
fi

echo "Unknown action: $ACTION"
show_usage
exit 1
