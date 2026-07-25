#!/usr/bin/env bash
set -e

# 施工方案比对工具桌面端打包脚本
# 用法：
#   ./build.sh              # 当前平台
#   ./build.sh mac-intel    # macOS Intel
#   ./build.sh mac-silicon  # macOS Apple Silicon
#   ./build.sh windows      # Windows（需 Windows 环境）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${SCRIPT_DIR}"

# 加载 Rust 环境
if [ -f "$HOME/.cargo/env" ]; then
	. "$HOME/.cargo/env"
fi

TARGET="${1:-current}"

# 根据目标平台确定 triple
TRIPLE=""
case "${TARGET}" in
	current)
		TRIPLE="${HOST_TRIPLE:-aarch64-apple-darwin}"
		;;
	mac-intel)
		TRIPLE="x86_64-apple-darwin"
		;;
	mac-silicon)
		TRIPLE="aarch64-apple-darwin"
		;;
	windows)
		TRIPLE="x86_64-pc-windows-msvc"
		;;
	*)
		echo "用法: $0 [current|mac-intel|mac-silicon|windows]"
		exit 1
		;;
esac

# 准备内嵌运行环境
echo "准备内嵌运行环境 (${TRIPLE})..."
./scripts/prepare-embedded.sh "${TRIPLE}"

case "${TARGET}" in
	current)
		npm run build
		;;
	mac-intel)
		npm run build:mac-intel
		;;
	mac-silicon)
		npm run build:mac-silicon
		;;
	windows)
		npm run build:windows
		;;
esac

echo ""
echo "=============================================="
echo "打包完成"
echo "产物目录: ${SCRIPT_DIR}/src-tauri/target/release/bundle/"
echo ""
echo "提示: 把 .app / .msi 放到工具根目录使用:"
echo "  cp -R '${SCRIPT_DIR}/src-tauri/target/release/bundle/macos/施工方案比对.app' '${TOOL_DIR}/'"
echo "=============================================="
