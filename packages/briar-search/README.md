# Briar Search — 本地代码搜索引擎

基于 Zoekt + Qdrant 的本地代码混合搜索引擎，支持跨仓库全文检索、语义向量搜索与业务域筛选。

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         查询层 (Query Layer)                        │
│              自然语言输入："导购换绑" / "CRM客户归属查询"              │
└─────────────────────────────┬───────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    混合检索引擎 (Hybrid Search)                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐   │
│  │  BM25 全文检索  │  │  业务域标签过滤 │  │  向量语义相似度排序    │   │
│  │  (Zoekt)       │  │  (业务元数据)   │  │  (Qdrant + FastEmbed) │   │
│  └────────────────┘  └────────────────┘  └────────────────────────┘   │
│                              ↓ 加权融合排序                            │
└─────────────────────────────┬───────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        索引层 (Index Layer)                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────────┐  │
│  │  Zoekt 代码索引  │ │  Qdrant 向量库   │ │   业务域元数据 (标签库)   │  │
│  └─────────────────┘ └─────────────────┘ └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 全文索引（一期）

```bash
# 安装 zoekt（需要 Go）
go install github.com/sourcegraph/zoekt/cmd/zoekt-git-index@latest
go install github.com/sourcegraph/zoekt/cmd/zoekt-webserver@latest

# 批量索引
./scripts/briar-init.sh -d /repos

# 或使用 Docker
./scripts/briar-init.sh --docker -d /repos --serve
```

### 2. 全文查询

```bash
./scripts/briar-search.sh -d 导购 "换绑"
./scripts/briar-search.sh -d CRM -l go "customer"
```

### 3. 语义向量索引（二期）

```bash
# 启动 Qdrant
docker-compose -f docker-compose.qdrant.yml up -d

# 安装 Python 依赖
pip install fastembed qdrant-client

# 建立语义索引
./scripts/semantic_index.py -d /repos
```

### 4. 混合检索

```bash
./scripts/hybrid_search.py "导购换绑"
./scripts/hybrid_search.py --semantic-only "客户归属查询"
```

## 业务域配置

编辑 `config/domains.json` 添加业务域规则：

```json
{
  "domains": {
    "导购": {
      "repo_patterns": ["guide-*", "导购*", "guider-*"]
    }
  }
}
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `scripts/briar-init.sh` | 初始化全文索引 |
| `scripts/briar-search.sh` | 全文搜索查询 |
| `scripts/semantic_index.py` | 语义向量索引（二期） |
| `scripts/hybrid_search.py` | 混合检索（二期） |
| `scripts/search_service.py` | Python API 封装 |
| `config/domains.json` | 业务域规则配置 |
| `docker-compose.yml` | Zoekt 服务部署 |
| `docker-compose.qdrant.yml` | Qdrant 向量库部署 |
| `500_repo_semantic_search_tech_proposal.md` | 技术方案文档 |

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 全文索引 | Zoekt | Google 出品，Sourcegraph 底层引擎 |
| 向量存储 | Qdrant | 开源向量数据库，支持混合检索 |
| 嵌入生成 | FastEmbed | Qdrant 官方，轻量纯 CPU |
| 业务标签 | JSON 规则 + 预留 LLM 接口 | 仓库名通配映射 |
| 部署 | Docker Compose | 一键本地部署 |

## 资源估算

以 500 个仓库、50GB 源码为基准：

| 资源项 | 估算值 |
|--------|-------|
| Zoekt 全文索引 | ~150GB 磁盘 |
| Qdrant 向量索引 | ~20GB 磁盘 |
| 运行内存 | 16GB+ |
| 首次全量索引 | 4–8 小时 |
| 增量索引 | 分钟级 |
