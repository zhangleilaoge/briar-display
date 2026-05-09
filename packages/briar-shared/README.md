# @briar/shared

共享工具库和类型定义，用于 Briar monorepo 中的所有包。

## 功能

- 通用工具函数
- TypeScript 类型定义
- 应用常量

## 使用

在其他 package 中引用：

```typescript
import { formatDate, generateId, type User, APP_NAME } from "@briar/shared"

// 使用工具函数
const id = generateId()
const dateStr = formatDate(new Date())

// 使用类型
const user: User = {
  id: "123",
  name: "John",
  email: "john@example.com",
  createdAt: new Date(),
}

// 使用常量
console.log(APP_NAME) // 'Briar'
```

## 开发

```bash
# 构建
bun run --filter @briar/shared build

# 监听模式
bun run --filter @briar/shared dev

# 清理
bun run --filter @briar/shared clean
```

## 自动构建

当其他包依赖 @briar/shared 时，如果 dist 目录不存在，会自动触发构建。
