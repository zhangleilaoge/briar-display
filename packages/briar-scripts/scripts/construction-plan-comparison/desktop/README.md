# 施工方案比对工具桌面端

基于 Tauri v2 的桌面 GUI，已内嵌 Bun 运行时和 Python 虚拟环境，**目标机器零配置**。

## 功能

- 拖拽多份 PDF 文件到窗口
- 点击"开始比对"调用 CLI
- 实时显示运行日志
- 完成后自动打开 `index.all-in-one.html`

## 使用方式

直接双击打开 `.app` 或安装 `.dmg` / `.msi`，无需安装 Bun 或 Python。

> 应用体积约 650MB（主要来自 PyTorch 虚拟环境），这是「零配置」的代价。

## 开发

```bash
cd desktop
npm install

# 准备内嵌运行环境（复制 Bun 二进制 + 工具资源）
./scripts/prepare-embedded.sh

# 开发模式
npm run dev
```

## 打包

### macOS（当前机器是 Apple Silicon）

```bash
cd desktop
npm run build

# 或跑封装脚本（会自动准备内嵌环境）
./build.sh
```

产物：
- `desktop/src-tauri/target/release/bundle/macos/施工方案比对.app`
- `desktop/src-tauri/target/release/bundle/dmg/施工方案比对_1.0.0_aarch64.dmg`

### macOS Intel

需要 Intel Mac 或交叉编译工具链，以及 Intel 版 Bun 二进制：

```bash
cd desktop
./scripts/prepare-embedded.sh x86_64-apple-darwin
npm run build:mac-intel
```

### Windows

必须在 Windows 环境构建：

```bash
cd desktop
# 先下载 Windows 版 Bun 放到 src-tauri/binaries/bun-x86_64-pc-windows-msvc.exe
./scripts/prepare-embedded.sh x86_64-pc-windows-msvc
npm run build:windows
```

## 快捷入口

在工具根目录的 `package.json` 中也添加了打包入口：

```bash
cd packages/briar-scripts/scripts/construction-plan-comparison
npm run desktop:build
```

## 内嵌了哪些东西

| 内容 | 位置 | 说明 |
|------|------|------|
| Bun 运行时 | `src-tauri/binaries/bun-*` | Tauri sidecar |
| 工具源码 | `src-tauri/resources/tool/src/` | 现有 TS 代码 |
| Python 环境 | `src-tauri/resources/tool/python_encoder/.venv/` | PyTorch / PyMuPDF / Pillow |
