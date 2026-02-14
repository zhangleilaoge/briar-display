.PHONY: help install dev dev:node dev:shared build build:shared preview clean

# 默认目标
help:
	@echo "可用命令："
	@echo "  make install     - 安装所有依赖"
	@echo "  make dev         - 启动前端开发服务器"
	@echo "  make dev:node    - 启动后端开发服务"
	@echo "  make dev:shared  - 启动 shared 包监听模式"
	@echo "  make build       - 构建所有包"
	@echo "  make build:shared - 仅构建 shared 包"
	@echo "  make preview     - 预览前端生产构建"
	@echo "  make clean       - 清理构建产物"

# 安装依赖
install:
	pnpm install

# 启动前端开发服务器
dev:
	pnpm --filter @briar/display dev

# 启动后端开发服务
dev:node:
	pnpm --filter @briar/node dev

# 启动 shared 包监听模式
dev:shared:
	pnpm --filter @briar/shared dev

# 构建所有包（先构建 shared，再构建 display）
build:
	pnpm --filter @briar/shared build && pnpm --filter @briar/display build

# 仅构建 shared 包
build:shared:
	pnpm --filter @briar/shared build

# 预览前端生产构建
preview:
	pnpm --filter @briar/display preview

# 清理构建产物
clean:
	rm -rf packages/briar-display/dist
	rm -rf packages/briar-display/node_modules/.astro
	rm -rf packages/briar-shared/dist
	rm -rf node_modules
