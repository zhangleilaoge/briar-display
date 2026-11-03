#!/usr/bin/env bash
set -e

# 用法：./scripts/bump-version.sh（对外版本 vYYYYMMDD.N，同日递增 N）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${DESKTOP_DIR}"

CURRENT_VERSION=$(node scripts/version.cjs display)
NEW_VERSION=$(node scripts/version.cjs next)
echo "更新日期版本: ${CURRENT_VERSION} -> ${NEW_VERSION}"
node scripts/version.cjs sync
