#!/usr/bin/env bash
set -e

# 施工方案比对工具桌面端打包脚本
# 用法：
#   ./build.sh                       # 当前平台
#   ./build.sh --release             # 当前平台，打包后上传到 GitHub Release
#   ./build.sh mac-intel             # macOS Intel
#   ./build.sh mac-intel --release   # macOS Intel，打包后上传
#   ./build.sh mac-silicon           # macOS Apple Silicon
#   ./build.sh windows               # Windows（需 Windows 环境）
#   ./build.sh windows --release     # Windows，打包后上传

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${SCRIPT_DIR}"

# 解析参数
RELEASE=false
TARGET="current"
for arg in "$@"; do
	case "${arg}" in
		--release|-r)
			RELEASE=true
			;;
		--help|-h)
			echo "用法: $0 [current|mac-intel|mac-silicon|windows] [--release]"
			exit 0
			;;
		-*)
			echo "未知选项: ${arg}"
			echo "用法: $0 [current|mac-intel|mac-silicon|windows] [--release]"
			exit 1
			;;
		*)
			TARGET="${arg}"
			;;
	esac
done

# 计时辅助函数
run_with_timing() {
	local label="$1"
	shift
	echo ""
	echo "[$(date '+%H:%M:%S')] 开始: ${label}"
	local start=$SECONDS
	"$@"
	local status=$?
	local elapsed=$((SECONDS - start))
	echo "[$(date '+%H:%M:%S')] 结束: ${label} (耗时 ${elapsed}s)"
	return ${status}
}

SCRIPT_START=$SECONDS

# 加载 Rust 环境
if [ -f "$HOME/.cargo/env" ]; then
	. "$HOME/.cargo/env"
fi

# Windows Git Bash：把 MSVC 的 link.exe 放到 PATH 最前面，避免用到 /usr/bin/link
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "mingw"* ]]; then
	VSWHERE="/c/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe"
	if [ -f "$VSWHERE" ]; then
		VS_INSTALL_PATH=$("$VSWHERE" -products '*' -property installationPath 2>/dev/null | head -1 | tr -d '\r')
		if [ -n "$VS_INSTALL_PATH" ]; then
			MSVC_BIN=$(find "$VS_INSTALL_PATH/VC/Tools/MSVC" -maxdepth 3 -path '*/bin/Hostx64/x64' -type d 2>/dev/null | sort | tail -1)
			if [ -n "$MSVC_BIN" ]; then
				export PATH="$MSVC_BIN:$PATH"
			fi
		fi
	fi
fi

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
run_with_timing "准备内嵌运行环境" ./scripts/prepare-embedded.sh "${TRIPLE}"

# Tauri 构建（npm script 已包含版本提示和计时）
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
case "${TARGET}" in
	windows)
		BUNDLE_DIR="${SCRIPT_DIR}/src-tauri/target/x86_64-pc-windows-msvc/release/bundle"
		DESKTOP_DIR="$(cygpath -u "${USERPROFILE}")/Desktop"
		mkdir -p "${DESKTOP_DIR}"
		cp -f "${BUNDLE_DIR}"/msi/*.msi "${DESKTOP_DIR}/" 2>/dev/null || true
		cp -f "${BUNDLE_DIR}"/nsis/*.exe "${DESKTOP_DIR}/" 2>/dev/null || true
		echo "Windows 产物:"
		echo "  ${BUNDLE_DIR}/msi/施工方案比对_*.msi"
		echo "  ${BUNDLE_DIR}/nsis/施工方案比对_*.exe"
		echo ""
		echo "已复制到桌面:"
		echo "  ${DESKTOP_DIR}/施工方案比对_*.msi"
		;;
	mac-intel|mac-silicon|current)
		echo "macOS 产物:"
		echo "  ${SCRIPT_DIR}/src-tauri/target/release/bundle/macos/施工方案比对.app"
		echo "  ${SCRIPT_DIR}/src-tauri/target/release/bundle/dmg/施工方案比对_*.dmg"
		echo ""
		echo "提示: 把 .app 放到工具根目录使用:"
		echo "  cp -R '${SCRIPT_DIR}/src-tauri/target/release/bundle/macos/施工方案比对.app' '${TOOL_DIR}/'"
		;;
esac
# 上传到 GitHub Release
if [ "${RELEASE}" = true ]; then
	echo ""
	./scripts/upload-release.sh "${TARGET}"
fi

TOTAL_ELAPSED=$((SECONDS - SCRIPT_START))
echo ""
echo "总耗时: ${TOTAL_ELAPSED}s"
echo "=============================================="
