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

## 插画 / 图标 / 纹理（本仓库自绘，无第三方素材）

以下均为手写 SVG / CSS，随本仓库授权：

- `src/components/ui/ornaments.tsx`：侧栏浮雕图标（蝴蝶结、墨水瓶、浮雕像、折扇、星、钥匙、玫瑰），草莓、怀表、钢笔、邮戳、希腊爱奥尼柱
- `src/components/ui/astrolabe.tsx`：旋转星盘
- `src/components/ui/ribbon-sidebar.tsx`：行李吊牌形状
- `src/styles/theme.css`：纸纹噪点（SVG `feTurbulence` data URI）、HUD 四角角标（CSS 渐变）、邮票齿边（CSS mask）、背景渐变

未使用任何游戏《重返未来:1999》的原始美术资源、截图、Logo 或字体；只参考其整体配色与版式气质。
