---
name: briar-search
description: "在 Briar 代码搜索引擎中执行查询。基于 Zoekt 实现跨仓库全文检索，支持业务域筛选、仓库过滤、关键词/正则搜索、语义向量搜索（Qdrant + FastEmbed）、混合检索（BM25 + 向量）。当用户需要：1) 搜索代码仓库内容，2) 按业务域（导购/CRM/支付等）筛选代码，3) 跨多个仓库查找代码文件，4) 自然语言语义搜索代码时触发。要求先执行 skill/briar-init 建立索引。"
---

# Briar Search — 本地代码搜索引擎查询

在已初始化的 Zoekt 索引上执行全文检索、语义向量搜索与混合检索。

## 快速开始

```bash
# 基础关键词搜索
./scripts/briar-search.sh "rebind"

# 按业务域筛选
./scripts/briar-search.sh -d 导购 "换绑"

# 多条件组合
./scripts/briar-search.sh -d CRM -l go "customer"

# JSON 输出
./scripts/briar-search.sh --json "导购 AND 换绑"

# 交互模式
./scripts/briar-search.sh -i
```

## 查询语法

| 语法 | 说明 | 示例 |
|------|------|------|
| `repo:xxx` | 仓库筛选 | `repo:guide.*` |
| `file:xxx` | 文件筛选 | `file:.*\.go` |
| `lang:xxx` | 语言筛选 | `lang:java` |
| `AND` | 布尔组合 | `导购 AND 换绑` |
| `"xxx"` | 短语搜索 | `"导购换绑"` |

## 业务域配置

业务域规则位于 `config/domains.json`，支持按仓库名通配符自动筛选：

| 业务域 | 匹配规则示例 |
|--------|-------------|
| 导购 | `guide-*`, `导购*`, `guider-*` |
| CRM | `crm-*`, `customer-*`, `客户*` |
| 支付 | `pay-*`, `payment-*`, `收银*` |
| 订单 | `order-*`, `订单*`, `trade-*` |
| 库存 | `stock-*`, `inventory-*`, `库存*` |
| 商品 | `product-*`, `goods-*`, `sku-*` |
| 营销 | `marketing-*`, `promo-*`, `coupon-*` |
| 消息推送 | `message-*`, `push-*`, `notification-*` |
| 用户 | `user-*`, `account-*`, `auth-*`, `sso-*` |

## 混合检索（二期）

融合 Zoekt BM25 + Qdrant 向量语义排序：

```bash
# 混合检索（默认）
./scripts/hybrid_search.py "导购换绑"

# 仅语义搜索
./scripts/hybrid_search.py --semantic-only "客户归属查询"

# 仅全文搜索
./scripts/hybrid_search.py --zoekt-only -d 支付 "收银台"
```

## 环境变量

- `ZOEKT_HOST` — Zoekt 服务地址（默认 `http://localhost:6070`）
- `ZOEKT_INDEX_DIR` — 索引目录（默认 `项目目录/.zoekt`）

## 前置要求

必须先执行 `skill/briar-init` 建立索引，否则搜索无结果。
