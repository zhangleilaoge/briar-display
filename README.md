# Briar Monorepo

基于 pnpm workspace 的 monorepo 项目，包含前端展示和 Node.js 后端服务。

## 项目结构

```
/
├── packages/
│   ├── briar-display/     # 前端项目 (Astro + React + Vue)
│   ├── briar-node/        # Node.js 后端服务
│   └── briar-shared/      # 共享工具库和类型定义
├── briar-assets/          # 子模块：资源文件
├── pnpm-workspace.yaml    # pnpm workspace 配置
├── Makefile               # 构建命令
└── package.json           # 根 package.json
```

## 技术栈

### @briar/display (前端)

- **Astro** - 静态站点生成器
- **React** - UI 组件库
- **Vue** - UI 组件库
- **TypeScript** - 类型支持

### @briar/node (后端)

- **Node.js** - 运行时环境

### @briar/shared (共享库)

- **TypeScript** - 类型定义
- **tsup** - 构建工具

## 快速开始

### 克隆项目

```bash
# 克隆主仓库
git clone https://github.com/your-username/briar-display.git
cd briar-display

# 初始化并拉取子模块
git submodule update --init --recursive
```

### 安装依赖

```bash
pnpm install
# 或使用 Makefile
make install
```

### 启动开发服务器

```bash
# 启动前端开发服务器
pnpm dev
# 或
make dev

# 启动 Node.js 后端服务
pnpm dev:node
# 或
make dev:node
```

前端开发服务器将在 `http://localhost:4321` 启动。

## 可用命令

### Monorepo 命令

使用 Makefile 简化操作：

| 命令                | 说明                     |
| :------------------ | :----------------------- |
| `make install`      | 安装所有依赖             |
| `make dev`          | 启动前端开发服务器       |
| `make dev:node`     | 启动后端开发服务         |
| `make dev:shared`   | 启动 shared 包监听模式   |
| `make build`        | 构建所有包（含依赖顺序） |
| `make build:shared` | 仅构建 shared 包         |
| `make preview`      | 预览前端生产构建         |
| `make clean`        | 清理构建产物             |

或直接使用 pnpm：

| 命令                                 | 说明                    |
| :----------------------------------- | :---------------------- |
| `pnpm install`                       | 安装所有依赖            |
| `pnpm dev`                           | 启动前端开发服务器      |
| `pnpm dev:node`                      | 启动后端开发服务        |
| `pnpm dev:shared`                    | 启动 shared 包监听模式  |
| `pnpm build`                         | 构建所有包              |
| `pnpm build:shared`                  | 仅构建 shared 包        |
| `pnpm preview`                       | 预览前端生产构建        |
| `pnpm --filter @briar/display <cmd>` | 在前端 package 执行命令 |
| `pnpm --filter @briar/node <cmd>`    | 在后端 package 执行命令 |
| `pnpm --filter @briar/shared <cmd>`  | 在共享 package 执行命令 |

## Packages 说明

### @briar/shared

共享工具库和类型定义，可被其他所有 package 引用。

特性：

- 自动构建：当 display 或 node 构建时，如果 shared 未构建，会自动触发构建
- TypeScript 类型定义
- 通用工具函数和常量

详见：[packages/briar-shared/README.md](packages/briar-shared/README.md)

### @briar/display

前端展示项目，使用 Astro 构建，集成 React 和 Vue 组件。

详见：[packages/briar-display/README.md](packages/briar-display/README.md)

### @briar/node

Node.js 后端服务包。

详见：[packages/briar-node/README.md](packages/briar-node/README.md)

## 了解更多

- [pnpm Workspace](https://pnpm.io/workspaces)
- [Astro 文档](https://docs.astro.build)
- [React 文档](https://react.dev)
- [Vue 文档](https://vuejs.org)
