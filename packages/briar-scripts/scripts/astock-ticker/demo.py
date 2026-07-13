#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Astock-ticker 的非 TUI 演示：
复用同样的新浪接口和自选股列表，直接打印实时行情表。
"""

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


def getprice(ticker):
    """获取单只股票行情。

    支持 A 股（sz/sh）和港股（hk）。
    A 股格式：6 位数字代码，如 002142
    港股格式：hk + 代码，如 hk01810（小米集团－Ｗ）
    """
    tickerurl = "http://hq.sinajs.cn/list="
    code = str(ticker).lower().strip()

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
    # 新浪返回 GBK
    text = res.content.decode('gbk', errors='ignore')

    # 格式：var hq_str_sh600518="康美药业,1.290,1.280,1.300,...";
    inner = text.split('"')[1]
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

    return name, open_, pre_close, cur


COLS = {'name': 16, 'price': 12, 'pre': 12, 'chg': 12, 'pct': 12}


def pad(s, width):
    w = wcswidth(str(s))
    if w < width:
        return str(s) + ' ' * (width - w)
    return str(s)


def demo():
    print(f"\nAstock-ticker 行情演示 ({time.strftime('%H:%M:%S')})")
    print("-" * sum(COLS.values()))
    print(pad('股票', COLS['name']) +
          pad('现价', COLS['price']) +
          pad('昨收', COLS['pre']) +
          pad('涨跌额', COLS['chg']) +
          pad('涨跌幅', COLS['pct']))
    print("-" * 62)

    rows = []
    for t in tickers:
        try:
            name, open_, pre_close, cur = getprice(t)
            change = float(cur) - float(pre_close)
            change_pct = change / float(pre_close) * 100
            rows.append((change_pct, name, cur, pre_close, change))
        except Exception as e:
            print(f"{t:<10} 获取失败: {e}")

    # 按涨跌幅从高到低排序
    rows.sort(key=lambda x: x[0], reverse=True)

    for change_pct, name, cur, pre_close, change in rows:
        print(pad(name, COLS['name']) +
              pad(f"{float(cur):.3f}", COLS['price']) +
              pad(f"{float(pre_close):.3f}", COLS['pre']) +
              pad(f"{change:+.3f}", COLS['chg']) +
              pad(f"{change_pct:+.2f}%", COLS['pct']))

    print("-" * sum(COLS.values()))


if __name__ == '__main__':
    demo()
