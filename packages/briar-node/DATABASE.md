# 数据库设置指南

## 数据库配置

本项目使用 **MySQL 8.0** 数据库。

### 环境变量配置

在 `packages/briar-node/.env` 文件中配置数据库连接信息：

```env
BRIAR_DATABASE_HOST="your-database-host"
BRIAR_DATABASE_PORT=3306
BRIAR_DATABASE_USER="your-username"
BRIAR_DATABASE_PASSWORD="your-password"
BRIAR_DATABASE_NAME="briar"

BRIAR_JWT_SECRET="your-jwt-secret"
```

## 初始化数据库

### 方式一：使用初始化脚本（推荐）

```bash
# 在项目根目录执行
bun run --filter @briar/node db:setup
```

该脚本会：

1. 创建 `briar` 数据库（如果不存在）
2. 创建 `users` 表
3. 插入默认管理员账户

### 方式二：手动执行 SQL

连接到 MySQL 服务器后，执行 `packages/briar-node/src/db/schema.sql` 文件中的 SQL 语句。

```bash
mysql -h your-host -u your-user -p < packages/briar-node/src/db/schema.sql
```

## 数据库表结构

### users 表

| 字段          | 类型         | 说明         |
| ------------- | ------------ | ------------ |
| id            | VARCHAR(36)  | 用户唯一标识 |
| name          | VARCHAR(100) | 用户名       |
| email         | VARCHAR(255) | 邮箱（唯一） |
| password_hash | VARCHAR(255) | 密码哈希值   |
| created_at    | TIMESTAMP    | 创建时间     |
| updated_at    | TIMESTAMP    | 更新时间     |

## 默认管理员

系统不会自动创建管理员账户。首次部署时，第一个注册的用户不会自动获得管理员权限。

要将某个用户设为超级管理员，将其邮箱配置在 `packages/briar-node/src/services/authService.ts` 的 `ADMIN_EMAIL` 常量中。服务启动时会自动为该用户分配 `admin` 角色。

## 数据库连接

项目使用 `mysql2` 库的连接池管理数据库连接。

- 最大连接数: 10
- 自动重连: 启用
- 队列限制: 无限制

## 常见问题

### 连接失败

1. 检查数据库服务是否启动
2. 验证 `.env` 文件中的配置是否正确
3. 确认数据库用户有足够的权限
4. 检查防火墙设置

### 表已存在

如果表已存在，初始化脚本会跳过创建步骤，不会报错。

### 字符集问题

数据库使用 `utf8mb4` 字符集，支持完整的 Unicode 字符（包括 emoji）。
