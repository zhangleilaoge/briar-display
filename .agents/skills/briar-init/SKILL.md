---
name: briar-init
description: "初始化 Briar 代码搜索引擎索引。基于 Zoekt 为本地 Git 仓库建立全文索引，支持批量目录扫描、Docker 部署、业务域自动打标。当用户需要：1) 为代码仓库建立搜索引擎索引，2) 初始化代码搜索环境，3) 批量导入仓库到 Zoekt，4) 部署本地代码搜索服务时触发。会自动检测并安装缺失的依赖（Go、Zoekt、Docker）。"
---

# Briar Init — 代码搜索引擎初始化

为本地 Git 仓库建立 Zoekt 全文索引，支持自动依赖安装与业务域打标。

## 快速开始

```bash
# 批量索引目录下所有仓库
./scripts/briar-init.sh -d /repos

# 指定多个仓库
./scripts/briar-init.sh /repos/guide-service /repos/crm-attribution

# Docker 部署（推荐）
./scripts/briar-init.sh --docker -d /repos --serve
```

## 依赖自动安装

脚本会自动检测并安装缺失的依赖：

| 依赖 | 检测方式 | 安装方式 |
|------|---------|---------|
| Go | `which go` | `brew install go` / `apt install golang-go` |
| Zoekt | `which zoekt-git-index` | `go install github.com/sourcegraph/zoekt/...` |
| Docker | `which docker` | `brew install --cask docker` / `apt install docker-ce` |

## 业务域自动打标

索引过程中自动读取 `config/domains.json`，按仓库名通配规则为仓库打上业务域标签（导购/CRM/支付/订单/库存/商品/营销/消息推送/用户）。

## 环境变量

- `REPOS_ROOT` — 仓库根目录（默认 `/repos`）
- `ZOEKT_INDEX_DIR` — 索引输出目录（默认 `项目目录/.zoekt`）

## 索引存储

索引默认存放在当前项目目录下的 `.zoekt/` 中，已被 `.gitignore` 忽略。
