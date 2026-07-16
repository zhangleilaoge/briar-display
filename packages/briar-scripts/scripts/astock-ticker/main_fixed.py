#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Astock-ticker 的修复版：
- 新浪接口加 Referer，避免被拦截
- 用 GBK 正确解码中文名称
- 修复科创板 68 开头代码被误判为上证指数的问题
- 涨跌颜色改为 A 股习惯：红涨绿跌
"""

import urwid
import requests
import time
from wcwidth import wcswidth

# 自选股列表（从同花顺截图导入）
tickers = [
    '002142', '002867', '600968', '159887', '001965', '000063', '600789', '000729',
    '601919', '601169', '601997', '601728', '000550', '600233', '600690', '002223',
    '603529', '002883', '601360', '002236', '600392', '600754', '000100', '002392',
    '600580', '002179', '600522', '002008', '601127', '002465',
    'hk01810',  # 小米集团－Ｗ
]

# 容错状态
last_error = None
last_success_time = None


def getprice(ticker):
    """获取单只股票行情，失败时返回错误标记，不抛异常。

    支持 A 股（sz/sh）和港股（hk）。
    A 股格式：6 位数字代码，如 002142
    港股格式：hk + 代码，如 hk01810（小米集团－Ｗ）
    """
    tickerurl = "http://hq.sinajs.cn/list="
    code = str(ticker).lower().strip()

    try:
        if code.startswith('hk'):
            # 港股：规范化为 hk + 5 位数字
            num = code[2:].zfill(5)
            url = tickerurl + 'hk' + num
            market = 'hk'
        elif code.startswith(('00', '30', '15', '16')):
            url = tickerurl + 'sz' + code
            market = 'a'
        elif code.startswith(('6', '68', '51', '56', '58')):
            url = tickerurl + 'sh' + code
            market = 'a'
        else:
            url = tickerurl + 'sh' + code
            market = 'a'

        res = requests.get(
            url,
            headers={'Referer': 'https://finance.sina.com.cn'},
            timeout=5
        )
        text = res.content.decode('gbk', errors='ignore')
        inner = text.split('"')[1]
        if not inner:
            return False, ticker, '-', '-', '-'

        parts = inner.split(',')
        if market == 'hk':
            # 港股格式：英文名,中文名,开盘价,昨收,最高,最低,最新价,涨跌额,涨跌幅,...
            name = parts[1] if parts[1] else (parts[0] if parts[0] else ticker)
            open_ = parts[2]
            pre_close = parts[3]
            cur = parts[6]
        else:
            # A 股格式：名称,开盘价,昨收,最新价,...
            name = parts[0] if parts[0] else ticker
            open_ = parts[1]
            pre_close = parts[2]
            cur = parts[3]

        return True, name, open_, pre_close, cur
    except Exception:
        return False, ticker, '-', '-', '-'


palette = [
    ('titlebar', 'dark red,bold', ''),
    ('refresh button', 'dark green,bold', ''),
    ('quit button', 'dark red', ''),
    ('getting quote', 'dark blue', ''),
    ('headers', 'white,bold', ''),
    ('change up', 'dark red', ''),
    ('change down', 'dark green', ''),
    ('change flat', 'white', '')
]

header_text = urwid.Text(u' A/H-stock Quotes (fixed)')
header = urwid.AttrMap(header_text, 'titlebar')

menu = urwid.Text([
    u'Press (', ('refresh button', u'R'), u') to manually refresh. ',
    u'Press (', ('quit button', u'Q'), u') to quit.'
])

quote_text = urwid.Text(u'Press (R) to get your first quote!')
quote_filler = urwid.Filler(quote_text, valign='top', top=1, bottom=1)
v_padding = urwid.Padding(quote_filler, left=1, right=1)
quote_box = urwid.LineBox(v_padding)

layout = urwid.Frame(header=header, body=quote_box, footer=menu)


COLS = {'name': 16, 'price': 12, 'pre': 12, 'chg': 12, 'pct': 12}


def pad(s, width):
    """按终端显示宽度补齐空格（正确处理中文）"""
    w = wcswidth(s)
    if w < width:
        return s + ' ' * (width - w)
    return s


def append_field(l, s, width, color='white'):
    l.append((color, pad(str(s), width)))


def render_row(updates, name, cur, pre_close, change, change_pct, color='change flat'):
    append_field(updates, name, COLS['name'])
    append_field(updates, cur, COLS['price'], color)
    append_field(updates, pre_close, COLS['pre'])
    append_field(updates, change, COLS['chg'], color)
    append_field(updates, '{}%'.format(change_pct), COLS['pct'], color)
    updates.append('\n')


def get_update():
    global last_error, last_success_time

    updates = []
    append_field(updates, 'Stock', COLS['name'], 'headers')
    append_field(updates, 'Cur_Price', COLS['price'], 'headers')
    append_field(updates, 'Pre_Close', COLS['pre'], 'headers')
    append_field(updates, 'Change', COLS['chg'], 'headers')
    append_field(updates, 'Change%', COLS['pct'], 'headers')
    updates.append('\n')

    success_rows = []
    failed_rows = []

    for t in tickers:
        ok, name, open_, pre_close, cur = getprice(t)
        if not ok:
            failed_rows.append((t, name))
            continue

        try:
            raw_change = float(cur) - float(pre_close)
            change = round(raw_change, 2)
            change_pct = round(raw_change / float(pre_close) * 100, 2)
        except ValueError:
            raw_change = 0
            change = 0
            change_pct = 0

        color = 'change flat'
        if raw_change > 0:
            color = 'change up'
        elif raw_change < 0:
            color = 'change down'

        success_rows.append((change_pct, name, cur, pre_close, change, change_pct, color))

    # 按涨跌幅从高到低排序
    success_rows.sort(key=lambda x: x[0], reverse=True)

    for row in success_rows:
        render_row(updates, *row[1:])

    for _, name in failed_rows:
        append_field(updates, name, COLS['name'], 'change flat')
        append_field(updates, 'timeout', COLS['price'], 'change flat')
        append_field(updates, '-', COLS['pre'])
        append_field(updates, '-', COLS['chg'])
        append_field(updates, '-', COLS['pct'])
        updates.append('\n')

    fail_count = len(failed_rows)
    if fail_count == 0:
        last_success_time = time.strftime('%H:%M:%S')
        last_error = None
    else:
        last_error = f'{fail_count} 只股票获取失败'

    # 状态行
    updates.append('\n')
    if last_error:
        append_field(updates, f'⚠ {last_error} (上次成功: {last_success_time or "无"})', 60, 'change down')
    else:
        append_field(updates, f'✓ 数据正常  刷新时间: {last_success_time}', 60, 'change up')

    return updates


def handle_input(key):
    if key in ('R', 'r'):
        refresh(main_loop, '')
    if key in ('Q', 'q'):
        raise urwid.ExitMainLoop()


def refresh(_loop, _data):
    global last_error
    try:
        quote_box.base_widget.set_text(get_update())
    except Exception as e:
        last_error = str(e)
        error_text = [
            ('change down', f'刷新异常: {e}\n'),
            ('change flat', '5 秒后自动重试...')
        ]
        quote_box.base_widget.set_text(error_text)

    main_loop.draw_screen()
    main_loop.set_alarm_in(5, refresh)


main_loop = urwid.MainLoop(layout, palette, unhandled_input=handle_input)


def cli():
    main_loop.set_alarm_in(0, refresh)
    main_loop.run()


if __name__ == '__main__':
    cli()
