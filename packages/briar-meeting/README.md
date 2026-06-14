# Briar Meeting

会议纪要桌面端应用，支持一键录制、实时转写、角色区分、PDF 上下文补充与 AI 分块总结。

## 包结构

```
packages/briar-meeting/
├── packages/meeting-sdk/   # 平台无关核心 SDK
└── packages/meeting-app/   # Electron 桌面应用
```

## 功能

- 一键开始本地录音（麦克风）。
- 实时语音识别（Web Speech API）并展示原文对话。
- 基于停顿的角色分段，支持手动编辑说话人名称。
- 两种实时视图：原文对话 / 分块总结。
- 会前/会后上传 PDF，作为大模型总结上下文。
- 接入 Kimi API 自动生成分块总结（需配置 API Key）。
- 会议数据本地持久化。

## 开发

```bash
# 安装依赖
bun install

# 开发模式（热重载）
bun run dev:meeting

# 构建 SDK + 应用并打包
bun run build:meeting

# 类型检查
bun run --filter @briar/meeting-sdk typecheck
bun run --filter @briar/meeting-app typecheck
```

## 配置 Kimi

在应用内点击右上角「设置」按钮，输入 Kimi API Key 与模型（默认 `moonshot-v1-8k`）。Key 仅保存在本地 localStorage。

## 后续扩展

- 接入 pyannote.audio / Azure 实现更精确的角色分离。
- 支持系统音频录制。
- 接入飞书文档作为上下文来源。
