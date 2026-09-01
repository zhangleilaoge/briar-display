---
name: briar-mail
description: 发送邮件（支持附件），无需任何邮箱凭证——直连收件方 MX 服务器投递。触发词："发邮件"、"发到邮箱"、"把文件发给我"、"email 给我"。
---

# briar-mail — 发邮件

把文本或文件（发票、文档、图片等）以邮件形式发送给指定收件人，支持多个收件人和多个附件。

## 触发场景

- 用户说"发到我的邮箱"、"把 XX 文件 email 给我"、"发邮件给 xxx@yyy.com"
- 需要把会话中的产物（生成的文件、用户上传的附件）通过邮件交付

## 工作流

### Step 1 — 确认要素

- **收件人**：用户未明确时，默认用 `git config user.email` 作为"发给我自己"的地址
- **附件**：确认文件路径存在
- **主题/正文**：从上下文推断（如文件名），不必过度追问

### Step 2 — 发送

```bash
python3 briar-mail.py --to <addr> --subject <主题> [--body <正文>] [--attach <文件>]...
```

示例：

```bash
python3 briar-mail.py --to 1371018512@qq.com \
  --subject '发票 - dzfp_xxx.pdf' \
  --body '发票 PDF 见附件。' \
  --attach /path/to/dzfp_xxx.pdf
```

多收件人/多附件：重复 `--to` / `--attach` 即可。不同域名的收件人会按 MX 分组分别投递。

### Step 3 — 告知结果

脚本输出 `ok: <addr> <- via <mx>` 即 MX 服务器已接收（250）。

**必须提醒用户**：因直连投递未走授权中继，SPF 为 softfail，邮件**可能进垃圾箱**，收件箱没有时去垃圾邮件找。

## 原理与限制

- 按收件人域名 `dig MX` 解析，直连对方 MX 服务器 25 端口投递，发件人默认 `zhangleilaoge@xiaobuzi.cn`（可用 `--sender` 覆盖）
- 仅依赖 Python3 标准库 + 系统 `dig`，macOS 开箱即用
- 仅支持**发送**，不支持收信/读信
- 对方服务器已返回 250 不代表一定进收件箱（可能进垃圾箱，极少数情况被静默丢弃）；重要文件发送后建议让用户确认收到

## 关键约定

- 发件人默认 `zhangleilaoge@xiaobuzi.cn`，不要随意伪造他人域名
- 附件路径必须先验证存在再调用脚本
- 脚本出错（MX 解析失败、连接被拒）时如实报告，不要谎报已发送
