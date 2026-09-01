#!/usr/bin/env python3
"""briar-mail: 无需任何凭证，直连收件方 MX 服务器投递邮件（支持附件）。

用法:
  briar-mail.py --to <addr> [--to <addr2>] --subject <主题> [--body <正文>] [--attach <文件>]...

原理: 按收件人域名解析 MX 记录，直接 SMTP 投递（25 端口），发件人默认
zhangleilaoge@xiaobuzi.cn。因未走授权中继，SPF 为 softfail，邮件可能进垃圾箱，
输出末尾会提示。
"""
import argparse
import os
import smtplib
import subprocess
import sys
from email import encoders
from email.header import Header
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

DEFAULT_FROM = 'zhangleilaoge@xiaobuzi.cn'

MIME_TYPES = {
    '.pdf': ('application', 'pdf'),
    '.png': ('image', 'png'),
    '.jpg': ('image', 'jpeg'),
    '.jpeg': ('image', 'jpeg'),
    '.gif': ('image', 'gif'),
    '.zip': ('application', 'zip'),
    '.txt': ('text', 'plain'),
    '.md': ('text', 'markdown'),
    '.csv': ('text', 'csv'),
    '.xlsx': ('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    '.docx': ('application', 'vnd.openxmlformats-officedocument.wordprocessingml.document'),
}


def resolve_mx(domain: str) -> str:
    out = subprocess.run(
        ['dig', '+short', 'MX', domain], capture_output=True, text=True, check=True
    ).stdout.splitlines()
    hosts = sorted(
        (line.split() for line in out if len(line.split()) == 2),
        key=lambda p: int(p[0]),
    )
    if not hosts:
        sys.exit(f'error: 无法解析 {domain} 的 MX 记录')
    return hosts[0][1].rstrip('.')


def build_message(args) -> MIMEMultipart:
    msg = MIMEMultipart()
    msg['From'] = args.sender
    msg['To'] = ', '.join(args.to)
    msg['Subject'] = Header(args.subject, 'utf-8')
    msg.attach(MIMEText(args.body or '', 'plain', 'utf-8'))
    for path in args.attach or []:
        if not os.path.isfile(path):
            sys.exit(f'error: 附件不存在: {path}')
        maintype, subtype = MIME_TYPES.get(
            os.path.splitext(path)[1].lower(), ('application', 'octet-stream')
        )
        with open(path, 'rb') as f:
            part = MIMEBase(maintype, subtype)
            part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header(
            'Content-Disposition', 'attachment',
            filename=('utf-8', '', os.path.basename(path)),
        )
        msg.attach(part)
    return msg


def main() -> None:
    p = argparse.ArgumentParser(description='直连 MX 发送邮件（支持附件）')
    p.add_argument('--to', action='append', required=True, help='收件人，可多次')
    p.add_argument('--subject', required=True, help='主题')
    p.add_argument('--body', default='', help='正文（纯文本）')
    p.add_argument('--attach', action='append', help='附件路径，可多次')
    p.add_argument('--sender', default=DEFAULT_FROM, help=f'发件人（默认 {DEFAULT_FROM}）')
    args = p.parse_args()

    msg = build_message(args)

    # 按收件人域名分组投递（同一封邮件只支持同一域的 MX）
    by_domain = {}
    for addr in args.to:
        by_domain.setdefault(addr.split('@')[-1], []).append(addr)

    for domain, addrs in by_domain.items():
        mx = resolve_mx(domain)
        with smtplib.SMTP(mx, 25, timeout=20) as s:
            s.ehlo(args.sender.split('@')[-1])
            s.sendmail(args.sender, addrs, msg.as_string())
        print(f'ok: {", ".join(addrs)} <- via {mx}')

    print('note: 未走授权中继，SPF 为 softfail，邮件可能进入收件方垃圾箱，请提醒收件人检查。')


if __name__ == '__main__':
    main()
