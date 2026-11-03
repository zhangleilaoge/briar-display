# 施工方案比对工具桌面端

基于 Tauri v2 的桌面 GUI，已内嵌 Bun 运行时和 Python 虚拟环境，**目标机器零配置**。

## 功能

- 拖拽多份 PDF 文件到窗口
- 点击"开始比对"调用 CLI
- 实时显示运行日志
- 完成后自动打开 `index.all-in-one.html`

## 使用方式

直接双击打开 `.app` 或安装 `.dmg` / `.msi`，无需安装 Bun 或 Python。

> 应用内嵌资源约 505MB（主要来自 PyTorch 虚拟环境），这是「零配置」的代价。Windows 安装包压缩后约 190MB。

## 开发

```bash
cd bid-compare-desktop
npm install

# 先确保 CLI 工具的 Python 虚拟环境已创建
# （桌面端会把整个 venv 内嵌到 app bundle 中，约 500MB+）
cd ../bid-compare && ./setup.sh && cd ../bid-compare-desktop

# 准备内嵌运行环境（复制 Bun 二进制 + 工具资源）
# 已存在时会智能跳过，可加 --force 强制重新准备
./scripts/prepare-embedded.sh

# 开发模式
npm run dev
```

## 打包

所有 `build` / `release` 脚本都会先检查内嵌环境，已准备好则跳过（避免重复复制 505MB 资源）。

### macOS（当前机器是 Apple Silicon）

```bash
cd bid-compare-desktop
npm run build

# 或
./build.sh
```

产物：
- `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/施工方案比对.app`
- `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/施工方案比对_v20261102.1_aarch64.dmg`

### macOS Intel

需要 Intel Mac 或交叉编译工具链，以及 Intel 版 Bun 二进制：

```bash
cd bid-compare-desktop
npm run build:mac-intel

# 或
./build.sh mac-intel
```

### Windows

必须在 Windows 环境构建，依赖：

- [Rust](https://www.rust-lang.org/tools/install)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/?q=build+tools)（勾选「使用 C++ 的桌面开发」+ Windows SDK）

```bash
cd bid-compare-desktop
# 自动准备内嵌环境、调用 MSVC、打包并复制 MSI 到桌面
npm run build:windows

# 或
./build.sh windows
```

产物：
- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/施工方案比对_v20261102.1_x64_en-US.msi`
- `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/施工方案比对_v20261102.1_x64-setup.exe`
- 同时自动复制 `.msi` 到当前用户桌面

> Windows 版本运行后，默认把比对结果输出到用户桌面（`bid_compare_result_<时间戳>` 文件夹），macOS 保持下载目录不变。

## 发布到 GitHub Release

打包后自动上传 `.dmg` / `.msi` / `.exe` 到 GitHub Release，标签格式为 `desktop-vYYYYMMDD.N`。

前提：安装并登录 GitHub CLI

```bash
# macOS
brew install gh && gh auth login

# Windows
winget install --id GitHub.cli
gh auth login
```

### macOS

```bash
cd bid-compare-desktop
./build.sh --release
# 或
./build.sh mac-silicon --release
```

### Windows

```bash
cd bid-compare-desktop
./build.sh windows --release
```

跨平台发布流程：先在 macOS 上跑 `./build.sh --release` 上传 `.dmg`，再在 Windows 上跑 `./build.sh windows --release` 上传 `.msi` 和 `.exe`，两者会合并到同一个 Release。

## 版本号

所有桌面端构建统一使用“日期 + 当日序号”：对外显示 `vYYYYMMDD.N`（例如 `v20261102.1`），同一天后续构建递增为 `.2`、`.3`，跨日期从 `.1` 重新开始，不再需要交互选择或 `BUMP` 环境变量。

`package.json` 的 `displayVersion` 记录对外日期版本；应用界面、安装包文件名和 Release 标签统一显示为 `vYYYYMMDD.N`。Cargo、npm 和 Tauri 的内部版本保留自动递增的三段式格式，以兼容 Windows 安装器的版本号限制。每次构建都会同步更新 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `src-tauri/Cargo.lock`。

只需手动更新日期版本时运行：

```bash
./scripts/bump-version.sh
```

## 快捷入口

在工具根目录的 `package.json` 中也添加了打包入口：

```bash
cd packages/briar-scripts/scripts/bid-compare
npm run desktop:build
```

## 上传到 GitHub Release

打包完成后，`./build.sh` 会询问是否上传到 GitHub Release。需要满足：

1. 安装 GitHub CLI：
   ```bash
   winget install --id GitHub.cli
   ```
2. 登录 GitHub：
   ```bash
   gh auth login
   ```

然后 `./build.sh windows` 打完包后选择 `y` 即可自动创建 Release 并上传 `.msi`/`.exe`（macOS 上传 `.dmg`）。

非交互/CI 用法：

```bash
UPLOAD_RELEASE=1 ./build.sh windows
```

## 内嵌了哪些东西

| 内容 | 位置 | 说明 |
|------|------|------|
| Bun 运行时 | `src-tauri/binaries/bun-*` | Tauri sidecar |
| 工具源码 | `src-tauri/resources/tool/src/` | 现有 TS 代码 |
| Python 环境 | `src-tauri/resources/tool/python_encoder/.venv/` | PyTorch / PyMuPDF / Pillow |
