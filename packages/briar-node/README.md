# @briar/node

基于 Hono 的 Node.js 后端服务，提供 API 接口和静态资源托管。

## 技术栈

- **Hono** - 轻量级、高性能 Web 框架
- **TypeScript** - 类型安全
- **tsup** - 快速构建工具
- **tsx** - TypeScript 执行器（开发模式）

## 功能特性

✅ **API 路由** - 处理 `/api/*` 路径的请求  
✅ **静态托管** - 托管前端构建产物  
✅ **SPA 支持** - 自动回退到 index.html  
✅ **共享类型** - 使用 @briar/shared 的类型和工具

## 开发

### 启动开发服务器

```bash
# 在项目根目录
pnpm --filter @briar/node dev

# 或使用快捷命令
pnpm dev:node
# 或
make dev:node
```

开发服务器将在 `http://localhost:3888` 启动。

### 构建生产版本

```bash
# 构建
pnpm --filter @briar/node build

# 启动生产服务器
pnpm --filter @briar/node start
```

## API 端点

### 健康检查

```bash
GET /api/health
```

### 服务器信息

```bash
GET /api/info
```

### 生成 ID

```bash
GET /api/generate-id
```

### 用户管理

```bash
# 获取用户列表
GET /api/users

# 创建用户
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

## 项目结构

```
/
├── src/
│   ├── index.ts           # 服务器入口
│   └── routes/
│       └── api.ts         # API 路由定义
├── dist/                  # 构建输出
├── tsconfig.json          # TypeScript 配置
├── tsup.config.ts         # 构建配置
└── package.json
```

## 环境变量

```bash
PORT=3888  # 服务器端口（默认 3000）
```

## 部署

生产环境部署步骤：

```bash
# 1. 构建前端
pnpm --filter @briar/display build

# 2. 构建后端
pnpm --filter @briar/node build

# 3. 启动服务器
pnpm --filter @briar/node start
```

所有请求（包括页面和 API）都由 Node.js 服务器处理。
