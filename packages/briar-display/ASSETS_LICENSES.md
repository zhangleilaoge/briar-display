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

背景与角饰只用平面线稿 / 剪影；**禁止** Fluent Emoji 3D、茶壶、小天使。每种具象素材全站至多出现一次（见下表「使用处」）；Arcane 星盘为 HUD 系统件，各 Arcane 页共享。

| 文件 | 组件 | 使用处（单点） | 来源 | 授权 | 改动 |
| --- | --- | --- | --- | --- | --- |
| `pocket-watch.svg` | `PocketWatch` | 邮票输入条左侧 | https://commons.wikimedia.org/wiki/File:Pocket_watch_gold.svg | CC0 1.0 | viewBox、svgo |
| `inkwell-pen.svg` | `InkwellPen` | 邮票输入条右侧 | https://commons.wikimedia.org/wiki/File:Inkwell_with_pen_(black-version).svg | CC0 | 无 |
| `gothic-arch.svg` | `GothicArch` | 门户问候卡旁 | Wikimedia Commons | CC BY-SA 3.0 | 改色、svgo |
| `dove-olive.svg` | `DoveOlive` | 个人页 accent | Wikimedia Commons | CC0 / PD | 改色、svgo |
| `floral-round.svg` | `FloralRound` | 注册页 BrandCollage | Wikimedia Commons（Everybody’s floral ornament） | Public Domain | 改色、svgo |
| `fleur-de-lis.svg` | `FleurDeLis` | 登录页 BrandCollage | https://commons.wikimedia.org/wiki/File:Fleur_de_lis_flat.svg | CC0 | 无 |
| `scissors-psf.svg` | `ScissorsCut` | 工具箱 accent | https://commons.wikimedia.org/wiki/File:Scissors_(PSF).svg | Public Domain（Pearson Scott Foresman） | 无 |
| `ionic-column.svg` | `GreekColumn` | 文件页 accent | https://commons.wikimedia.org/wiki/File:Ionic_order.svg | Public Domain | 裁切单柱、改色、svgo |
| `compass-rose.svg` | `CompassRose` | 行情页 accent | https://commons.wikimedia.org/wiki/File:Simple_compass_rose.svg | CC BY 3.0（Brosen / Howcheng） | 无 |
| `antique-key.svg` | `AntiqueKey` | 管理后台 accent | https://commons.wikimedia.org/wiki/File:PPKey01.svg | CC0 | 无 |
| `floral-secession.svg` | （BlogLayout `<img>`） | 博客背景角饰 | https://commons.wikimedia.org/wiki/File:Secessionistische_Zeitung_floral_ornament,_1899.svg | Public Domain | 无 |
| `floral-1913.svg` | `FloralStamp` | 库内备用（未挂 UI） | Wikimedia Commons | Public Domain | 改色、svgo |
| `floral-lilien.svg` | `FloralLilien` | 库内备用（未挂 UI） | https://commons.wikimedia.org/wiki/File:Art_Nouveau_floral_ornament_by_E._M._Lilien.svg | Public Domain | 无 |
| `flower-psf.svg` | `FlowerPsf` | 库内备用（未挂 UI） | https://commons.wikimedia.org/wiki/File:GAMOPETALOUS_(PSF).svg | Public Domain（PSF） | 无 |
| `wax-seal.svg` | `WaxSeal` | 库内备用（未挂 UI） | https://commons.wikimedia.org/wiki/File:Wax-seal_-_Lorc_-_game-icons.svg | CC BY 3.0（Lorc / game-icons.net） | 无 |
| `lantern.svg` | `Lantern` | 库内备用（未挂 UI） | https://commons.wikimedia.org/wiki/File:Lantern.svg | CC0 | 无 |

自绘邮戳 `Postmark`（`ornaments.tsx`）仅用于门户问候卡。

CC BY / CC BY-SA 素材须保留署名；Fluent Emoji 已自本主题移除，MIT 声明块仍保留供 Phosphor 使用。

## 门户 / 想法页随机贴纸池（`src/assets/decor/portal/`）

`ScrapStickerDecor` 从 `SCRAP_STICKER_CATALOG`（≥30）随机抽几枚，叠在门户与想法页空白区；CSS `.rv-sticker-pad` 提供圆角白垫，**SVG 文件本身背景必须透明**（禁止全画布不透明白底矩形 / 嵌入白底栅格）。不进池示例：曾剔除的 `entablature-doric`（嵌入 PNG 白底）、`envelope`（纯白剪影）。

| 文件（节选） | 用途 | 来源概况 | 授权 | 改动 |
| --- | --- | --- | --- | --- |
| `ionic-column.svg` / `ionic-column-2.svg` | 随机池 tall | Wikimedia Ionic order 等 | Public Domain | 单色、透明底 |
| `floral-secession.svg` / `floral-1913.svg` / `floral-lilien.svg` / `floral-round.svg` | 随机池 | Wikimedia 新艺术线稿 | Public Domain | 单色 |
| `gothic-arch.svg` / `abbey.svg` / `greek-temple.svg` / `doric-temple.svg` | 随机池 | Wikimedia 建筑线稿 | CC BY-SA / PD | 透明底 |
| `lantern.svg` / `wax-seal.svg` / `scissors.svg` / `compass-rose.svg` / `antique-key.svg` / `fleur-de-lis.svg` | 随机池 | Wikimedia / game-icons | CC0 / CC BY / PD | 单色 |
| `corinthian-helmet.svg` / `laurel-wreath.svg` / `amphora.svg` / `lyre.svg` / `caduceus.svg` / `ankh.svg` 等 | 随机池 | Wikimedia 古典纹样 | PD / CC0 | 去白底垫、单色线稿 |
| 其余 `portal/*.svg`（花饰、蝴蝶、芦苇、星盘等） | 随机池 | Wikimedia / PSF 等 | PD / CC0 / CC BY | 透明底、svgo |

完整文件以 `scrapStickerCatalog.ts` 为准；新增贴纸须：黑白线稿、透明背景、可商用授权，并在本表补一行。

## 自绘部分（随本仓库授权）

只有简单几何图形是手写 SVG / CSS：

- `src/components/ui/ornaments.tsx`：`Postmark` 邮戳（同心圆 + 波浪线）
- `src/components/ui/stamp-input-bar.tsx`：钢笔平面剪影（自绘 SVG）
- `src/components/ui/astrolabe.tsx`：旋转星盘（圆环、刻度）
- `src/components/ui/ribbon-sidebar.tsx`：行李吊牌形状
- `src/styles/theme.css`：纸纹噪点（SVG `feTurbulence` data URI）、HUD 四角角标（CSS 渐变）、邮票齿边（CSS mask）、背景渐变、`.rv-panel` / `.rv-tile` / `.rv-barcode` / 水印汉字
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
