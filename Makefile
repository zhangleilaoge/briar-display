.PHONY: help init install dev dev-node dev-shared build build-shared build-cdn upload-cdn preview clean db-setup

# 默认目标
help:
	@echo "可用命令："
	@echo "  make init        - 初始化项目（首次使用）"
	@echo "  make install     - 安装所有依赖"
	@echo "  make db-setup    - 初始化数据库"
	@echo "  make dev         - 启动前端开发服务器"
	@echo "  make dev-node    - 启动后端开发服务"
	@echo "  make dev-shared  - 启动 shared 包监听模式"
	@echo "  make build       - 构建所有包"
	@echo "  make upload-cdn  - 上传前端构建产物到 CDN"
	@echo "  make build-cdn   - 构建前端并上传到 CDN"
	@echo "  make build-shared - 仅构建 shared 包"
	@echo "  make preview     - 预览前端生产构建"
	@echo "  make clean       - 清理构建产物"

# 项目初始化
init:
	@echo "================================================"
	@echo "🚀 开始初始化 Briar Display 项目..."
	@echo "================================================"
	@echo "📦 Step 1: 检查 briar-assets 子模块..."
	@if [ ! -f "briar-assets/.env" ]; then \
		echo "⚠️  briar-assets 未初始化，正在初始化子模块..."; \
		git submodule update --init --recursive; \
	else \
		echo "✅ briar-assets 已存在"; \
	fi
	@echo ""
	@echo "📋 Step 2: 拷贝环境变量文件..."
	@if [ -f "briar-assets/briar/.env" ]; then \
		cp "briar-assets/briar/.env" ".env"; \
		echo "✅ 环境变量文件已拷贝: briar-assets/briar/.env -> .env"; \
	else \
		echo "❌ 未找到 briar-assets/briar/.env 文件"; \
		exit 1; \
	fi
	@echo ""
	@echo "📦 Step 3: 安装项目依赖..."
	@bun install
	@echo ""
	@echo "================================================"
	@echo "✅ 项目初始化完成！"
	@echo "================================================"
	@echo "💡 下一步："
	@echo "   1. 运行 'make db-setup' 初始化数据库"
	@echo "   2. 运行 'make dev' 启动前端开发服务器"
	@echo "   3. 运行 'make dev-node' 启动后端服务"
	@echo "================================================"

# 安装依赖
install:
	bun install

# 初始化数据库
db-setup:
	@echo "🗄️  初始化数据库..."
	@bun run --filter @briar/node db:setup

# 配置 COS bucket CORS（前端分片直传需要，一次性）
cos-cors:
	@bun run --filter @briar/scripts cos:cors

# 启动全量开发服务（shared + display + node）
dev:
	bun dev

# 启动后端开发服务（并确保 shared 已构建）
dev-node:
	@if [ ! -f "packages/briar-shared/dist/index.js" ]; then \
		echo "📦 @briar/shared 未构建，先构建..."; \
		bun run --filter @briar/shared build; \
	fi
	@lsof -ti :3888 | xargs kill -9 2>/dev/null || true
	bun run --filter @briar/node dev

# 启动 shared 包监听模式
dev-shared:
	bun run --filter @briar/shared dev

# 构建所有包（先构建 shared，再构建 display）
build:
	bun run build

# 构建前端并上传到 CDN
build-cdn:
	bun run build && bun run --filter @briar/node upload:cdn

# 上传前端构建产物到 CDN
upload-cdn:
	bun run --filter @briar/node upload:cdn

# 仅构建 shared 包
build-shared:
	bun run --filter @briar/shared build

# 预览前端生产构建
preview:
	bun run --filter @briar/display preview

# 清理构建产物
clean:
	rm -rf packages/briar-display/dist
	rm -rf packages/briar-display/node_modules/.astro
	rm -rf packages/briar-shared/dist
	rm -rf node_modules
