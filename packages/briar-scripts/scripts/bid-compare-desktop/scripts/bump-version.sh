#!/usr/bin/env bash
set -e

# 版本号管理脚本
# 用法：
#   ./scripts/bump-version.sh patch   # 1.0.0 -> 1.0.1
#   ./scripts/bump-version.sh minor   # 1.0.0 -> 1.1.0
#   ./scripts/bump-version.sh major   # 1.0.0 -> 2.0.0
#   ./scripts/bump-version.sh 1.2.3   # 设置为指定版本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${DESKTOP_DIR}"

# 读取当前版本（从 Cargo.toml）
CURRENT_VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
KIND="${1:-patch}"

bump() {
	local version="$1"
	local kind="$2"
	local major minor patch
	major=$(echo "$version" | cut -d. -f1)
	minor=$(echo "$version" | cut -d. -f2)
	patch=$(echo "$version" | cut -d. -f3)
	case "$kind" in
		major)
			major=$((major + 1))
			minor=0
			patch=0
			;;
		minor)
			minor=$((minor + 1))
			patch=0
			;;
		patch)
			patch=$((patch + 1))
			;;
		*)
			echo "未知的 bump 类型: $kind"
			exit 1
			;;
	esac
	echo "${major}.${minor}.${patch}"
}

if [[ "$KIND" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	NEW_VERSION="$KIND"
else
	NEW_VERSION=$(bump "$CURRENT_VERSION" "$KIND")
fi

echo "更新版本: ${CURRENT_VERSION} -> ${NEW_VERSION}"

# 更新 Cargo.toml
sed -i.bak "s/^version = \".*\"/version = \"${NEW_VERSION}\"/" src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak

# 更新 tauri.conf.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"${NEW_VERSION}\"/" src-tauri/tauri.conf.json
rm -f src-tauri/tauri.conf.json.bak

# 更新 package.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"${NEW_VERSION}\"/" package.json
rm -f package.json.bak

# 更新 package-lock.json（根版本和 packages[""].version）
if [ -f package-lock.json ]; then
	sed -i.bak "s/^  \"version\": \".*\"/  \"version\": \"${NEW_VERSION}\"/" package-lock.json
	sed -i.bak "s/      \"version\": \".*\"/      \"version\": \"${NEW_VERSION}\"/" package-lock.json
	rm -f package-lock.json.bak
fi

echo "已同步更新:"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/tauri.conf.json"
echo "  - package.json"
echo "  - package-lock.json"
