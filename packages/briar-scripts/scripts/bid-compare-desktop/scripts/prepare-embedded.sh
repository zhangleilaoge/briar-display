#!/usr/bin/env bash
set -e

# 准备内嵌运行环境：Bun 二进制 + 工具资源
# 用法：./scripts/prepare-embedded.sh [platform] [--force]
# platform: aarch64-apple-darwin | x86_64-apple-darwin | x86_64-pc-windows-msvc

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TOOL_DIR="$(cd "${DESKTOP_DIR}/../bid-compare" && pwd)"

# 先检查源 Python 虚拟环境是否存在，缺失时直接失败并给出明确提示
SOURCE_VENV_DIR="${TOOL_DIR}/python_encoder/.venv"
if [ ! -d "${SOURCE_VENV_DIR}" ]; then
	echo "=============================================="
	echo "错误：未找到 Python 虚拟环境"
	echo "路径: ${SOURCE_VENV_DIR}"
	echo ""
	echo "桌面端打包需要把 Python 虚拟环境内嵌到 app bundle 中。"
	echo "请先创建虚拟环境："
	echo "  cd ${TOOL_DIR}"
	echo "  ./setup.sh"
	echo ""
	echo "然后再重新运行打包命令。"
	echo "=============================================="
	exit 1
fi

# 解析参数
FORCE=false
TARGET=""
for arg in "$@"; do
	case "${arg}" in
		--force|-f)
			FORCE=true
			;;
		--help|-h)
			echo "用法: $0 [platform] [--force]"
			exit 0
			;;
		-*)
			echo "未知选项: ${arg}"
			echo "用法: $0 [platform] [--force]"
			exit 1
			;;
		*)
			TARGET="${arg}"
			;;
	esac
done

# 默认当前平台
HOST_TRIPLE="aarch64-apple-darwin"
case "$(uname -sm)" in
	"Darwin arm64"|"Darwin ARM64") HOST_TRIPLE="aarch64-apple-darwin" ;;
	"Darwin x86_64"|"Darwin X86_64") HOST_TRIPLE="x86_64-apple-darwin" ;;
	"Linux x86_64") HOST_TRIPLE="x86_64-unknown-linux-gnu" ;;
	MINGW*|CYGWIN*|MSYS*) HOST_TRIPLE="x86_64-pc-windows-msvc" ;;
esac

TARGET="${TARGET:-${HOST_TRIPLE}}"

BUN_FILE="${DESKTOP_DIR}/src-tauri/binaries/bun-${TARGET}"
[ "${TARGET}" = "x86_64-pc-windows-msvc" ] && BUN_FILE="${BUN_FILE}.exe"

# 智能跳过：检查关键产物是否已存在
TOOL_RES_DIR="${DESKTOP_DIR}/src-tauri/resources/tool"
VENV_DIR="${TOOL_RES_DIR}/python_encoder/.venv"
NODE_MODULES_DIR="${TOOL_RES_DIR}/node_modules"

# macOS: 修复 Python venv 在 app bundle 中的 rpath
# Tauri 打包资源时会解引用 symlinks，导致 venv/bin/python 变成真实二进制。
# 该二进制依赖 @executable_path/../Python3，因此需要在 .venv 根目录提供 Python3。
# 这里把真实 Python 解释器复制到 .venv/Python3，确保打包后 dyld 能找到它。
fix_macos_python_rpath() {
	if [[ "$OSTYPE" != "darwin"* ]]; then
		return 0
	fi
	local venv_python="${VENV_DIR}/bin/python"
	local pyvenv_cfg="${VENV_DIR}/pyvenv.cfg"
	if [ ! -e "${venv_python}" ]; then
		echo "macOS: 未找到 ${venv_python}，跳过 rpath 修复"
		return 0
	fi
	if [ ! -f "${pyvenv_cfg}" ]; then
		echo "macOS: 未找到 ${pyvenv_cfg}，跳过 rpath 修复"
		return 0
	fi

	# macOS 上 venv/bin/python 经过 Tauri 打包后 rpath 会失效。
	# 稳妥做法：把 bin/python 替换成一个 shell wrapper，由它设置 VIRTUAL_ENV 并调用系统 Python。
	# 这样无论系统 Python 是 framework 还是 shim，只要路径/版本匹配就能工作。
	local home_dir
	home_dir=$(grep '^home = ' "${pyvenv_cfg}" | head -1 | sed 's/^home = //' | tr -d '\r')
	if [ -z "${home_dir}" ]; then
		echo "macOS: pyvenv.cfg 中未找到 home，跳过 rpath 修复"
		return 0
	fi

	local real_python=""
	for cand in "${home_dir}/python3" "${home_dir}/python" "${home_dir}/python3.$(python3 -c 'import sys; print(sys.version_info[1])' 2>/dev/null)"; do
		if [ -x "${cand}" ]; then
			real_python="${cand}"
			break
		fi
	done

	if [ -z "${real_python}" ]; then
		echo "macOS: 未找到系统 Python 解释器（home=${home_dir}），跳过 rpath 修复"
		return 0
	fi

	echo "macOS: 创建 bin/python wrapper 以绕过 app bundle 中的 rpath 问题..."
	echo "  系统 Python: ${real_python}"
	echo "  wrapper: ${venv_python}"

	# 如果 bin/python 是 symlink，直接覆盖会写到系统 Python；先删除再创建
	rm -f "${venv_python}"
	local py_version
	py_version=$("${real_python}" -c 'import sys; print(f"python{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
	cat > "${venv_python}" <<EOF
#!/bin/sh
# 由 prepare-embedded.sh 生成的 wrapper，用于在 app bundle 中正确激活 venv
VIRTUAL_ENV="\$(cd "\$(dirname "\$0")/.." && pwd)"
export VIRTUAL_ENV
PYTHONPATH="\${VIRTUAL_ENV}/lib/${py_version}/site-packages\${PYTHONPATH:+:\${PYTHONPATH}}"
export PYTHONPATH
exec "${real_python}" "\$@"
EOF
	chmod +x "${venv_python}"
	if [ -x "${venv_python}" ]; then
		echo "macOS: bin/python wrapper 创建成功"
		# 同步更新 python3 / python3.x 指向新 wrapper，避免脚本绕过 wrapper
		local venv_bin
		venv_bin=$(dirname "${venv_python}")
		local py_version
		py_version=$("${real_python}" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
		for alias in python3 "python3.${py_version}"; do
			local alias_path="${venv_bin}/${alias}"
			if [ -L "${alias_path}" ] || [ -e "${alias_path}" ]; then
				rm -f "${alias_path}"
				ln -s python "${alias_path}"
			fi
		done
	else
		echo "错误：bin/python wrapper 创建失败"
	fi
}

if [ "${FORCE}" = false ] && \
   [ -f "${BUN_FILE}" ] && \
   [ -d "${TOOL_RES_DIR}/src" ] && \
   [ -d "${VENV_DIR}" ] && \
   [ -d "${NODE_MODULES_DIR}" ]; then
	echo "=============================================="
	echo "内嵌运行环境已准备，跳过"
	echo "目标平台: ${TARGET}"
	echo "（如需强制重新准备，请加上 --force）"
	echo "=============================================="
	fix_macos_python_rpath
	exit 0
fi

echo "=============================================="
echo "准备内嵌运行环境"
echo "目标平台: ${TARGET}"
echo "=============================================="

mkdir -p "${DESKTOP_DIR}/src-tauri/binaries"
mkdir -p "${DESKTOP_DIR}/src-tauri/resources"

# 1. 准备 Bun 二进制
echo "准备 Bun 二进制..."

case "${TARGET}" in
	aarch64-apple-darwin)
		BUN_BIN="$(command -v bun || true)"
		if [ -z "${BUN_BIN}" ]; then
			echo "错误：未找到 bun，请先安装 Bun"
			exit 1
		fi
		cp "${BUN_BIN}" "${BUN_FILE}"
		chmod +x "${BUN_FILE}"
		;;
	x86_64-apple-darwin)
		BUN_BIN="$(command -v bun || true)"
		if [ -z "${BUN_BIN}" ]; then
			echo "错误：未找到 bun，请先安装 Bun"
			exit 1
		fi
		# 如果当前是 Intel Mac，直接复制；否则尝试下载
		if [ "${HOST_TRIPLE}" = "x86_64-apple-darwin" ]; then
			cp "${BUN_BIN}" "${BUN_FILE}"
			chmod +x "${BUN_FILE}"
		else
			echo "提示：当前是 Apple Silicon，构建 Intel 版需要下载 Intel Bun 二进制"
			echo "  请手动下载并放到: ${BUN_FILE}"
			echo "  下载地址: https://github.com/oven-sh/bun/releases"
			exit 1
		fi
		;;
	x86_64-pc-windows-msvc)
		if [ -f "${BUN_FILE}" ]; then
			echo "已存在 Windows Bun 二进制，跳过下载"
		else
			# 优先使用本机已安装的 bun.exe（npm 全局/本地包里的 Windows 二进制）
			LOCAL_BUN_EXE=""
			BUN_SHIM="$(command -v bun || true)"
			if [ -n "${BUN_SHIM}" ] && [ -f "$(dirname "${BUN_SHIM}")/node_modules/bun/bin/bun.exe" ]; then
				LOCAL_BUN_EXE="$(dirname "${BUN_SHIM}")/node_modules/bun/bin/bun.exe"
			elif [ -f "${LOCALAPPDATA}/.bun/bin/bun.exe" ]; then
				LOCAL_BUN_EXE="${LOCALAPPDATA}/.bun/bin/bun.exe"
			fi

			if [ -n "${LOCAL_BUN_EXE}" ]; then
				echo "使用本地 Bun 二进制: ${LOCAL_BUN_EXE}"
				cp "${LOCAL_BUN_EXE}" "${BUN_FILE}"
			else
				echo "本地未找到 bun.exe，从 GitHub 下载（可能较慢，建议先安装 Bun for Windows）..."
				TMP_DIR="$(mktemp -d)"
				trap 'rm -rf "${TMP_DIR}"' EXIT
				curl -fsSL -o "${TMP_DIR}/bun-windows-x64.zip" "https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip"
				unzip -q -o "${TMP_DIR}/bun-windows-x64.zip" -d "${TMP_DIR}"
				mv "${TMP_DIR}/bun.exe" "${BUN_FILE}"
				trap - EXIT
				rm -rf "${TMP_DIR}"
			fi
		fi
		;;
	*)
		echo "不支持的目标平台: ${TARGET}"
		exit 1
		;;
esac

echo "Bun 二进制: ${BUN_FILE} ($(du -sh ${BUN_FILE} | cut -f1))"

# 2. 复制工具资源到 resources/tool/
echo "复制工具资源..."
rm -rf "${DESKTOP_DIR}/src-tauri/resources/tool"
mkdir -p "${DESKTOP_DIR}/src-tauri/resources/tool"
cp -R "${TOOL_DIR}/src" "${DESKTOP_DIR}/src-tauri/resources/tool/src"
cp -R "${TOOL_DIR}/python_encoder" "${DESKTOP_DIR}/src-tauri/resources/tool/python_encoder"
cp "${TOOL_DIR}/package.json" "${DESKTOP_DIR}/src-tauri/resources/tool/package.json"
cp "${TOOL_DIR}/bun.lock" "${DESKTOP_DIR}/src-tauri/resources/tool/bun.lock"
cp "${TOOL_DIR}/tsconfig.json" "${DESKTOP_DIR}/src-tauri/resources/tool/tsconfig.json"

# 清理不需要的文件
rm -f "${DESKTOP_DIR}/src-tauri/resources/tool/python_encoder/.DS_Store"
find "${DESKTOP_DIR}/src-tauri/resources/tool" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "${DESKTOP_DIR}/src-tauri/resources/tool" -name "*.pyc" -delete 2>/dev/null || true

# 清理 Python venv 中打包/运行时不需要的文件（避免 WiX 长路径错误并减小体积）
VENV_DIR="${DESKTOP_DIR}/src-tauri/resources/tool/python_encoder/.venv"
if [ -d "${VENV_DIR}/Lib/site-packages" ]; then
	echo "清理 venv 中的头文件、测试、静态库和许可证目录..."
	rm -rf "${VENV_DIR}/Lib/site-packages/torch/include" 2>/dev/null || true
	rm -rf "${VENV_DIR}/Lib/site-packages/torchvision/include" 2>/dev/null || true
	find "${VENV_DIR}/Lib/site-packages" -type d -name "include" -exec rm -rf {} + 2>/dev/null || true
	find "${VENV_DIR}/Lib/site-packages" -type d \( -name "test" -o -name "tests" -o -name "testing" \) -exec rm -rf {} + 2>/dev/null || true
	find "${VENV_DIR}/Lib/site-packages" -type d -name "licenses" -exec rm -rf {} + 2>/dev/null || true
	find "${VENV_DIR}/Lib/site-packages" -type f \( -name "*.lib" -o -name "*.pdb" -o -name "*.a" \) -delete 2>/dev/null || true
fi

# macOS: 修复 Python venv 在 app bundle 中的 rpath
fix_macos_python_rpath

# 安装 TS 运行时依赖（零配置分发需要 node_modules）
echo "安装 TS 运行时依赖..."
cd "${DESKTOP_DIR}/src-tauri/resources/tool"
"${BUN_FILE}" install --frozen-lockfile --production
cd "${DESKTOP_DIR}"

echo "工具资源大小: $(du -sh ${DESKTOP_DIR}/src-tauri/resources/tool | cut -f1)"

echo ""
echo "=============================================="
echo "内嵌环境准备完成"
echo "=============================================="
