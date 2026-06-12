---
title: 编码代理工具使用指南
description: KimiCode 和 MimoCode 编码代理的选择、使用与切换
category: development
---

# 编码代理工具使用指南

## 工具对比

| 工具 | 提供商 | 默认模型 | 使用方式 | 特点 |
|------|--------|----------|----------|------|
| **KimiCode** | Moonshot AI | Kimi K2.5 | `kimi run "prompt"` | 成熟稳定，支持多轮对话恢复 |
| **MimoCode** | 小米 | MiMo-V2.5 | `mimo run "prompt"` | 内置免费模型，支持 ACP |

## 当前选择

**默认编码代理：KimiCode**（`@moonshot-ai/kimi-code@0.14.0`）

备选：MimoCode（如需要可随时切换）

## KimiCode 使用

### 基本命令

```bash
# 一次性任务
kimi run "review this code"

# 指定文件/目录
kimi run "fix the bug in src/index.ts" --file src/

# 多轮对话（恢复 session）
kimi run "continue" -S <session_id>

# 查看 session 列表
kimi session list
```

### 多轮对话恢复

1. 首次运行加 `--output-format stream-json` 抓 session ID
2. 后续用 `-S <session_id>` 恢复上下文

## MimoCode 使用

### 基本命令

```bash
# 一次性任务
mimo run "prompt"

# 查看支持的能力
mimo --acp-list

# 多轮对话
mimo run "continue" -s <session_id>

# 查看 session 历史
mimo session
```

### 特点

- 内置 MiMo-V2.5 免费模型
- 支持 ACP（Agent Communication Protocol）
- 原生 session 管理（`mimo session`）

## 切换默认代理

如需切换，修改调用命令即可：

```bash
# 用 KimiCode
kimi run "your prompt"

# 用 MimoCode
mimo run "your prompt"
```

## 在 Hermes 中调用

```bash
# 通过 delegate_task 委托编码任务
# 工具集: ['terminal', 'file']
# 命令: kimi run "implement feature X"
```

## 注意事项

- 旧版 `kimi-cli`（1.43.0）已移除，不要混用
- KimiCode 和 MimoCode 的 session 不互通
- 大项目注意内存占用（KimiCode RSS ~245MB）
