---
name: h5-standalone-demo
description: |
  把任意 H5 页面从源码抽成独立的单文件 HTML 演示页（样式 1:1 还原 + 可点交互 + mock 数据）。
  用于不给环境/不发布就能演示页面效果的场景：给产品/设计 review、需求评审、群上演示。
  触发词："抽成独立 html"、"出个演示页"、"standalone demo"、"不用发环境直接看效果"、"静态演示页"。
category: '前端'
tags: h5, demo, mock, html, 演示
---

# h5-standalone-demo — H5 页面抽成独立演示 HTML

目标产物：**单个 .html 文件**，双击即开，零依赖（不引 CDN、不装包），样式与真实页面一致，
核心交互可点，数据全部 mock。不是截图，是可操作的静态页。

## 工作流

### 1. 读源码，抓三样东西

- **结构**：页面入口（路由 → views/index.vue）+ 列表项/卡片组件。只抓视觉相关的 DOM 层级，
  业务逻辑（路由跳转、埋点、接口调用）全部丢弃。
- **样式契约**：从 scoped style 里抄设计 token——颜色、字号、行高、间距、圆角、按钮渐变。
  组件库（如 Vant）的默认色值也要抄（如 `#323233` 主文案 / `#969799` 次级文案 / `#f7f8fa` 背景）。
  样式逐个从源码抄，不要凭感觉编。
- **状态机**：页面有几个状态、状态之间怎么流转。这是交互部分的骨架。
  例：待触达 --(复制话术)--> 已复制未触达 --(手动确认)--> 已触达；两个 tab 各展示哪些状态。

### 2. 写 HTML，遵守这些约定

- **手机壳**：`body` 用深色背景，内容包一个 `width: 375px; margin: 0 auto` 的容器模拟手机宽度；
  加 `<meta viewport>` 保证真机上也是满宽。
- **单文件零依赖**：inline CSS + 原生 JS，不引框架/组件库/CSS 预处理器。
- **资源内联**：默认头像等静态资源用 inline SVG data URI 兜底，不依赖外网图片。
- **mock 数据镜像接口结构**：变量名/字段名直接抄前端 API 的 interface（如 `IStrategyCustomer`），
  每个状态至少造 1-2 条；数据文案尽量从真实页面截图/PRD 里抄，看起来才像真的。
- **交互只实现状态机**：tab 切换、状态流转、计数联动。复制话术这类能力用
  `navigator.clipboard.writeText` 并 catch 兜底。路由跳转/埋点不做。
- **时间格式化**：别引 date-fns，手写 `pad` + `getFullYear()` 拼 `YYYY-MM-DD HH:mm:ss`。
  （date-fns v2 的 token 是 `yyyy`，v1 是 `YYYY`，引错版本日期会错——不引就没这个问题。）

### 3. 验证：无头 Chrome 截图比对（必须做）

```bash
# macOS， Chrome headless 截图
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --screenshot=/tmp/demo.png --window-size=400,1000 \
  "file:///abs/path/to/demo.html"
```

- 截图后**必须读图检查**（ReadMediaFile），和真实页面截图并排比对：配色、间距、按钮、字号。
- **每个状态/tab 都要验**：默认状态不好切时，用 sed 把初始状态改掉生成临时副本再截：
  `sed "s/var currentTab = 'wait';/var currentTab = 'touched';/" demo.html > /tmp/demo-b.html`
- 有报错别忽略：截图空白/样式缺失先查 JS 报错。

## 常见坑

- **只截了一张图就交付**：第二个 tab / 触达后的状态没验证，演示时翻车。
- **样式凭印象写**：按钮渐变、tag 颜色必须抄源码里的具体色值，差一点都不像。
- **把 App 外壳抄进来**：原生导航栏、沉浸式头部是容器提供的，demo 里一般从内容区开始，
  除非演示重点就是它。
- **mock 数据太假**：`测试测试`、`asdf` 这种数据一出来演示效果全无；从真实截图抄文案。
- **文件放错位置**：演示 HTML 放 `docs/` 之类不进构建的目录，命名 `<page-name>-demo.html`，
  别放 `client/pages/**` 里被构建工具扫进去。

## 交付时说明

- 文件路径 + 打开方式（双击 / `open <path>`）。
- 哪些交互是活的（状态机部分），哪些是摆设（跳转、埋点）。
- mock 数据来源（截图/PRD/接口定义），刷新后状态是否重置（通常重置，和内存态逻辑一致时要点明）。

## 参考实现

guide-b-h5 仓库 `docs/one-customer-one-strategy-demo.html`（一客一策列表页：
双 tab + 三态状态机 + 卡片列表，单文件 8KB）。
