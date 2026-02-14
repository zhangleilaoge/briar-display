# @briar/display

基于 Astro 构建的多框架展示项目，集成了 React 和 Vue 组件。

## 技术栈

- **Astro** - 静态站点生成器
- **React** - UI 组件库
- **Vue** - UI 组件库
- **TypeScript** - 类型支持

## 开发

在项目根目录执行：

```bash
# 启动开发服务器
pnpm --filter @briar/display dev

# 或使用快捷命令
pnpm dev
# 或
make dev
```

开发服务器将在 `http://localhost:4321` 启动。

## 构建

```bash
# 构建生产版本
pnpm --filter @briar/display build

# 或
pnpm build
# 或
make build
```

## 预览

```bash
# 预览生产构建
pnpm --filter @briar/display preview

# 或
pnpm preview
# 或
make preview
```

## 项目结构

```
/
├── public/                # 静态资源
├── src/
│   ├── components/        # 组件
│   │   ├── astro/        # Astro 组件
│   │   ├── react/        # React 组件
│   │   └── vue/          # Vue 组件
│   ├── layouts/          # 布局组件
│   └── pages/            # 页面路由
├── astro.config.mjs      # Astro 配置
├── tsconfig.json         # TypeScript 配置
└── package.json
```
