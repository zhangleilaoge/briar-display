# 视觉素材来源与授权（Reverie / 重返未来:1999 风格主题）

本主题只使用可商用素材。新增或替换素材时请同步更新本文件。

## 字体（npm `@fontsource/*` 自托管，随构建打包）

| 字体 | 用途 | 包 | 授权 | 来源 |
| --- | --- | --- | --- | --- |
| Cormorant Garamond | 古典衬线标题 `--font-display` / `--font-heading` | `@fontsource/cormorant-garamond` | SIL Open Font License 1.1 | https://github.com/CatharsisFonts/Cormorant |
| Pinyon Script | 花体手写 `--font-script` | `@fontsource/pinyon-script` | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Pinyon+Script |
| Josefin Sans | 大写宽字距标签 / HUD 控件 `--font-label` | `@fontsource/josefin-sans` | SIL Open Font License 1.1 | https://github.com/googlefonts/josefinsans |
| JetBrains Mono | 代码块等宽字 `--font-mono` | `@fontsource/jetbrains-mono` | SIL Open Font License 1.1 | https://github.com/JetBrains/JetBrainsMono |

OFL 1.1 允许商用、嵌入与再分发，不得单独售卖字体文件本身。中文字形回退到系统字体（宋体/苹方等），未打包任何中文字体文件。

## 图标（npm 依赖）

| 素材 | 用途 | 包 / 来源 | 授权 |
| --- | --- | --- | --- |
| Phosphor Icons（duotone 风格：HouseLine、Toolbox、FolderOpen、BookOpenText、ChartLineUp、Key、UserCircle） | 侧栏吊牌图标、首页入口图标（`ornaments.tsx` 中 `HomeIcon` 等） | `@phosphor-icons/react`，https://github.com/phosphor-icons/react | MIT，Copyright (c) 2020 Phosphor Icons |
| Lucide | 组件内操作图标（原有依赖） | `lucide-react`，https://lucide.dev | ISC |

## 贴纸 / 插画（`src/assets/decor/`）

| 文件 | 用途 | 来源 | 作者 | 授权 | 改动 |
| --- | --- | --- | --- | --- | --- |
| `fluent-strawberry.png` | 草莓贴纸（`Strawberry`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Strawberry/3D | Microsoft | MIT，Copyright (c) Microsoft Corporation | 256px 缩放 |
| `fluent-ribbon.png` | 蝴蝶结贴纸（`Ribbon`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Ribbon/3D | Microsoft | MIT | 256px 缩放 |
| `fluent-fountain-pen.png` | 钢笔（`FountainPen`，输入栏） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Fountain%20pen/3D | Microsoft | MIT | 256px 缩放 |
| `fluent-envelope.png` | 信封贴纸（`Envelope`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Envelope/3D | Microsoft | MIT | 256px 缩放 |
| `fluent-sparkles.png` | 闪光贴纸（`Sparkles`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Sparkles/3D | Microsoft | MIT | 256px 缩放 |
| `pocket-watch.svg` | 怀表（`PocketWatch`，背景与输入栏） | https://commons.wikimedia.org/wiki/File:Pocket_watch_gold.svg | Mrmw | CC0 1.0（公有领域贡献） | 补 viewBox，svgo 压缩 |

| `fluent-dove.png` | 白鸽贴纸（`Dove`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Dove/3D | Microsoft | MIT | 256px 缩放 |
| `fluent-teapot.png` | 茶壶贴纸（`Teapot`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Teapot/3D | Microsoft | MIT | 256px 缩放 |
| `fluent-rose.png` | 玫瑰贴纸（`Rose`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Rose/3D | Microsoft | MIT | 256px 缩放 |
| `fluent-classical.png` | 古典建筑贴纸（`ClassicalBuilding`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Classical%20building/3D | Microsoft | MIT | 256px 缩放 |
| `fluent-ladder.png` | 梯子贴纸（`Ladder`） | https://github.com/microsoft/fluentui-emoji/tree/main/assets/Ladder/3D | Microsoft | MIT | 256px 缩放 |
| `cherub-postscript.svg` | 小天使剪纸（`Cherub`，弹窗角饰） | Wikimedia Commons（PostScript 雕版公有领域图） | Public Domain | Public Domain | 裁切、改藏青描边、svgo |
| `dove-olive.svg` | 白鸽线稿（`DoveOlive`） | Wikimedia Commons | Public Domain / CC0 | CC0 | 改色、svgo |
| `floral-1913.svg` | 1913 花饰（`FloralStamp`） | Wikimedia Commons | Public Domain | Public Domain | 改色、svgo |
| `floral-round.svg` | 圆形花饰（`FloralRound`） | Wikimedia Commons | Public Domain | Public Domain | 改色、svgo |
| `gothic-arch.svg` | 哥特尖拱（`GothicArch`） | Wikimedia Commons | 贡献者 | CC BY-SA 3.0 | 改色、svgo |
| `ionic-column.svg` | 爱奥尼柱（`GreekColumn`，Arcane 背景） | https://commons.wikimedia.org/wiki/File:Ionic_order.svg | F l a n k e r | Public Domain | 裁切为单柱、删除辅助线、改为主题蓝色描边/填充，svgo 压缩 |

Fluent Emoji 的 MIT 许可要求在副本中保留版权与许可声明，声明全文见文末。

## 自绘部分（随本仓库授权）

只有简单几何图形是手写 SVG / CSS：

- `src/components/ui/ornaments.tsx`：`Postmark` 邮戳（同心圆 + 波浪线）
- `src/components/ui/astrolabe.tsx`：旋转星盘（圆环、刻度）
- `src/components/ui/ribbon-sidebar.tsx`：行李吊牌形状
- `src/styles/theme.css`：纸纹噪点（SVG `feTurbulence` data URI）、HUD 四角角标（CSS 渐变）、邮票齿边（CSS mask）、背景渐变
- 配色：`src/styles/theme.css` 中的语义 token、文件夹色、`src/lib/chartPalette.ts` 图表色板，以及工具页（section / quiz）画布配色均为本主题自定

未使用任何游戏《重返未来:1999》的原始美术资源、截图、Logo 或字体；只参考其整体配色与版式气质。

## MIT 许可声明（Phosphor Icons / Microsoft Fluent Emoji）

```
MIT License

Copyright (c) 2020 Phosphor Icons
Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
