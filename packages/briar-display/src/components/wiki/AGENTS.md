# Wiki 模块 — Agent Guide

Wiki 是 Briar Display 的核心业务模块，采用 MediaWiki Vector 2022 风格，前后端分离架构。

## 后端架构

分层：`dal → service → controller → route`

| 层 | 路径 |
|:---|:---|
| Route | `packages/briar-node/src/routes/wiki.ts` |
| Controller | `packages/briar-node/src/controllers/wikiController.ts` |
| Service | `packages/briar-node/src/services/wikiService.ts` |
| DAL | `packages/briar-node/src/dal/wikiDal.ts` |

权限相关：

| 文件 | 作用 |
|:---|:---|
| `packages/briar-node/src/config/wikiPermissions.ts` | Wiki 路由权限映射表（单一权限来源） |
| `packages/briar-node/src/middleware/wikiWriteGuard.ts` | Wiki 写操作默认保护（安全网） |

## 前端架构

| 路径 | 作用 |
|:---|:---|
| `packages/briar-display/src/components/wiki/WikiApp.tsx` | SPA 路由入口 |
| `packages/briar-display/src/components/wiki/layout/` | 布局组件（WikiLayout, WikiSidebar, WikiTopbar） |
| `packages/briar-display/src/components/wiki/pages/` | 页面组件 |
| `packages/briar-display/src/components/wiki/common/` | 通用组件（WikiPagination, PermissionGuard 等） |
| `packages/briar-display/src/contexts/PermissionContext.tsx` | 前端权限上下文（React Context） |
| `packages/briar-display/src/api/admin.ts` | 前端权限管理 API |

## Wiki API 路由

- Pages:
  - `GET /api/wiki/pages` — 列表（?namespace, ?status, ?limit, ?offset）
  - `GET /api/wiki/pages/search` — 全文搜索（?q, ?limit, ?offset）
  - `GET /api/wiki/pages/:namespace/:slug` — 获取页面（自动跟踪重定向）
  - `GET /api/wiki/pages/:slug/redirects` — 获取重定向列表
  - `POST /api/wiki/pages`（需认证）— 创建页面
  - `PUT /api/wiki/pages/:slug`（需认证）— 更新页面
  - `DELETE /api/wiki/pages/:slug`（需认证）— 软删除页面
- Revisions:
  - `GET /api/wiki/pages/:slug/revisions` — 版本列表
  - `GET /api/wiki/pages/:slug/revisions/:revId` — 获取版本
  - `GET /api/wiki/pages/:slug/diff` — 版本差异（?from, ?to）
  - `POST /api/wiki/pages/:slug/revisions/:revId/revert`（需认证）— 回退版本
- Categories:
  - `GET /api/wiki/categories` — 列表
  - `GET /api/wiki/categories/tree` — 分类树
  - `GET /api/wiki/categories/:slug` — 分类详情（含页面列表）
  - `POST /api/wiki/categories`（需认证）
  - `PUT /api/wiki/categories/:slug`（需认证）
  - `DELETE /api/wiki/categories/:slug`（需认证）
  - `POST /api/wiki/categories/:slug/pages`（需认证）— 添加页面到分类
  - `DELETE /api/wiki/categories/:slug/pages/:pageId`（需认证）— 移除分类关联
- Discussions:
  - `GET /api/wiki/pages/:slug/discussions` — 讨论列表
  - `GET /api/wiki/pages/:slug/discussions/:topicId` — 获取讨论主题
  - `GET /api/wiki/pages/:slug/discussions/:topicId/replies` — 获取回复
  - `POST /api/wiki/pages/:slug/discussions`（需认证）— 创建讨论主题
  - `POST /api/wiki/pages/:slug/discussions/:topicId/replies`（需认证）— 创建回复
  - `PUT /api/wiki/pages/:slug/discussions/:topicId/resolve`（需认证）— 标记已解决
- Templates:
  - `GET /api/wiki/templates` — 列表
  - `GET /api/wiki/templates/:slug` — 获取模板
  - `POST /api/wiki/templates`（需认证）
  - `PUT /api/wiki/templates/:slug`（需认证）
  - `DELETE /api/wiki/templates/:slug`（需认证）
- Watchlist:
  - `GET /api/wiki/watchlist`（需认证）— 用户关注列表
  - `POST /api/wiki/watchlist/:slug`（需认证）— 关注页面
  - `DELETE /api/wiki/watchlist/:slug`（需认证）— 取消关注
  - `GET /api/wiki/watchlist/:slug/status`（需认证）— 检查是否关注
- Special Pages:
  - `GET /api/wiki/special/recent-changes` — 最近更改
  - `GET /api/wiki/special/statistics` — 统计数据
  - `GET /api/wiki/special/all-pages` — 所有页面
  - `GET /api/wiki/special/orphaned-pages` — 孤立页面
  - `GET /api/wiki/special/wanted-pages` — 缺失页面
  - `GET /api/wiki/special/user-contributions/:userId` — 用户贡献

## ⚠️ 新增 Wiki 写路由的规范（安全网机制）

**所有 Wiki 写操作（POST/PUT/DELETE）都必须在权限映射表中声明权限。**

权限映射表位于：`packages/briar-node/src/config/wikiPermissions.ts`

```ts
export const WIKI_ROUTE_PERMISSIONS: Record<string, string | null> = {
  'POST /pages': PERMISSIONS.WIKI_PAGE_CREATE,
  'PUT /pages/:slug': PERMISSIONS.WIKI_PAGE_UPDATE,
  // ...
}
```

**工作原理**：`wikiWriteGuard` 中间件拦截所有写请求，在映射表中查找所需权限：
1. **找到权限编码** → 检查用户是否拥有该权限
2. **标记为 `null`** → 显式公开，放行
3. **未找到（新路由忘了声明）** → **默认拒绝**，返回 403 + 控制台警告

**新增写路由的步骤**：

```ts
// 1. 在 wikiPermissions.ts 中添加权限映射
'POST /new-resource': PERMISSIONS.WIKI_NEW_RESOURCE,

// 2. 在 permissions.ts 中定义权限编码常量
WIKI_NEW_RESOURCE: 'wiki:new-resource:create',

// 3. 在 schema.sql 中插入权限记录（如果是新权限）
INSERT INTO permissions (id, code, name, type, module) VALUES
  ('perm-wiki-new-resource', 'wiki:new-resource:create', '创建新资源', 'api', 'wiki');

// 4. 为对应角色授权
INSERT INTO role_permissions (role_id, permission_id) VALUES ('role-editor', 'perm-wiki-new-resource');

// 5. 在 wiki.ts 中注册路由（不需要手动加 requirePermission）
wikiRoutes.post('/new-resource', (c) => controller.create(c))
```

**如果忘记在映射表中声明**：写操作会返回 403，控制台输出警告。

## 前端权限使用

Wiki SPA 已通过 `PermissionProvider` 包裹，所有子组件可使用：

```tsx
import { usePermissions } from '@/contexts/PermissionContext'

function MyComponent() {
  const { hasPermission, isAdmin, isLoggedIn } = usePermissions()

  if (!hasPermission('wiki:page:create')) return null
  return <Button>新建</Button>
}
```

### PermissionGuard 组件

用于条件渲染 UI 元素：

```tsx
import PermissionGuard from '@/components/wiki/common/PermissionGuard'

<PermissionGuard permission="wiki:page:delete">
  <Button variant="destructive">删除</Button>
</PermissionGuard>
```

### 管理后台页面

管理后台已独立为 Astro 页面（`/briar-display/admin/*`），不再属于 Wiki SPA。详见 `packages/briar-display/src/components/admin/` 目录。

侧边栏"管理"区域的链接指向独立管理后台，仅对拥有 `page:admin` 权限的用户可见。

## Wiki 数据库表

- `wiki_pages` — 页面（含 FULLTEXT 索引 ngram 分词）
- `wiki_revisions` — 版本历史
- `wiki_categories` — 分类（支持层级）
- `wiki_page_categories` — 页面-分类关联
- `wiki_discussions` — 讨论主题
- `wiki_discussion_replies` — 讨论回复
- `wiki_watchlist` — 关注列表
- `wiki_templates` — 模板

## UI 风格规范

参考 MediaWiki Vector 2022 皮肤。Wiki 主题通过 `.wiki-theme` 类作用于 WikiLayout 根节点，覆盖 shadcn CSS 变量实现。

### 组件层级

```
components/ui/            ← 标准 shadcn，任何业务都能用
components/wiki/common/ui/  ← Wiki 专用包装组件（覆盖尺寸/圆角/字号）
```

Wiki 页面**必须**从 `@/components/wiki/common/ui/` 导入组件，不要直接用 `@/components/ui/`：

```tsx
import { WikiButton as Button } from '@/components/wiki/common/ui/button'
import { WikiInput as Input } from '@/components/wiki/common/ui/input'
import { WikiTextarea as Textarea } from '@/components/wiki/common/ui/textarea'
import { WikiSelectTrigger } from '@/components/wiki/common/ui/select'
```

用 `as` 别名保持 JSX 中 `<Button>` `<Input>` 写法不变，减少改动成本。

### 颜色

| 用途 | CSS 变量 | 亮色值 |
|:---|:---|:---|
| 背景 | `--wiki-bg` | `#ffffff` |
| 次级背景 | `--wiki-bg-secondary` | `#f8f9fa` |
| 三级背景 | `--wiki-bg-tertiary` | `#eaecf0` |
| 边框 | `--wiki-border` | `#a2a9b1` |
| 浅边框 | `--wiki-border-light` | `#c8ccd1` |
| 链接/强调色 | `--wiki-link` | `#3366cc` |
| 链接悬停 | `--wiki-link-hover` | `#447ff5` |
| 正文 | `--wiki-text` | `#202122` |
| 次级文字 | `--wiki-text-secondary` | `#54595d` |
| 弱化文字 | `--wiki-text-muted` | `#72777d` |

颜色映射到 shadcn 语义变量（通过 `.wiki-theme` CSS 类）：

| shadcn 变量 | 映射来源 |
|:---|:---|
| `--primary` | `--wiki-link` |
| `--foreground` | `--wiki-text` |
| `--background` | `--wiki-bg` |
| `--border` / `--input` | `--wiki-border-light` |
| `--muted` | `--wiki-bg-tertiary` |
| `--muted-foreground` | `--wiki-text-muted` |
| `--ring` | `--wiki-link` |

### 输入框

- 统一使用 shadcn `Input` 组件（`@/components/ui/input`），颜色由 `.wiki-theme` 自动覆盖
- 高度：`h-8`（32px）
- 圆角：`rounded-sm`（2px）
- 字号：`text-[13px]`

### 按钮

- 使用 shadcn `Button` 组件，颜色由 `.wiki-theme` 自动覆盖
- `variant="default"` → wiki 蓝色主操作
- `variant="outline"` → wiki 次要操作
- 工具栏按钮：`h-8 w-8 rounded-sm`，激活态 `bg-primary text-primary-foreground`

### 间距

- 块元素 margin 使用 Tailwind Typography 配置覆盖（`tailwind.config.mjs`）
- 编辑器/表单内部间距：`space-y-3` 或 `gap-2`
