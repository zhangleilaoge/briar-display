# astock-ticker

A 股终端常驻行情看板，基于新浪实时行情接口。

## 文件

- `main_fixed.py`：终端 TUI 常驻看板，自动刷新
- `demo.py`：非 TUI 演示，打印一次行情表
- `briarstock`：全局命令入口脚本

## 全局命令注册

```bash
# 1. 确保 ~/.local/bin 在 PATH 中（macOS/Linux 标准用户二进制目录）
# 2. 创建软链接
ln -s ~/Documents/github/briar-display/packages/briar-scripts/scripts/astock-ticker/briarstock ~/.local/bin/briarstock

# 之后任意位置可运行
briarstock          # 启动 TUI 常驻看板
briarstock --demo   # 运行一次性演示
```

## 使用

按键：

- `R`：手动刷新
- `Q`：退出

## 容错机制

- 单只股票获取失败时显示 `timeout`，不会导致整个程序退出
- 刷新过程异常会自动捕获，5 秒后重试
- 底部状态行显示上次成功刷新时间或失败数量

## 修改自选股

编辑 `main_fixed.py` 或 `demo.py` 里的 `tickers` 列表：

```python
tickers = [
    '002142', '002867', '600968', '159887', '001965', '000063',
    # ...
]
```

支持：

- 深市主板/创业板：`00xxxx`、`30xxxx`
- 沪市主板/科创板：`60xxxx`、`68xxxx`
- ETF/LOF：`15xxxx`、`51xxxx`、`56xxxx`、`58xxxx`
- 港股：`hk` + 代码，如 `hk01810`（小米集团－Ｗ）、`hk00700`（腾讯控股）

## 数据来源

- 新浪财经 `hq.sinajs.cn`
- 仅用于看盘，不构成投资建议
