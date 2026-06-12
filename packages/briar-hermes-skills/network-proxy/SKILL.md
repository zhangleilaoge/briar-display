---
title: 网络代理配置与故障排查
description: 外网代理（mihomo）和公司内网（飞连/corplink）的配置、管理与故障排查流程
category: devops
---

# 网络代理配置与故障排查

## 概述

本机网络分两条线：
- **外网**：mihomo（Clash Meta）HTTP 代理端口 7890
- **公司内网**：飞连（corplink）WireGuard 接口，访问 Jira/GitLab 等

两者共存，互不冲突。外网不走飞连，内网不走 mihomo。

## 外网代理（mihomo）

### 服务信息
- 端口：7890（HTTP/SOCKS5）
- API：127.0.0.1:9090
- 配置：/etc/mihomo/config.yaml
- **TUN 关闭**（auto-route 劫持所有流量，节点不通则全断网）

### 所有外网操作必须主动带代理

```bash
# 示例：访问 Google
curl -x http://127.0.0.1:7890 -s https://www.google.com

# 示例：git 克隆外网仓库
git -c http.proxy=http://127.0.0.1:7890 clone https://github.com/xxx/xxx.git
```

### 故障排查流程

**第一步：确认本地网络正常**
```bash
curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 https://www.baidu.com
# 200 = 本地网络正常，继续排查代理
# 失败 = 本地网络断了，检查网卡/路由器
```

**第二步：并行测所有节点延迟，找能用的**

```bash
#!/usr/bin/env python3
"""并行测试 mihomo 所有节点延迟，选最优节点"""
import json
import urllib.request
import urllib.parse
import concurrent.futures
import sys

MIHOMO_API = 'http://127.0.0.1:9090'
TIMEOUT_MS = 3000
REQUEST_TIMEOUT = 5
TEST_URL = 'http://www.gstatic.com/generate_204'

def test_node(name):
    encoded = urllib.parse.quote(name, safe='')
    url = f'{MIHOMO_API}/proxies/{encoded}/delay?timeout={TIMEOUT_MS}&url={TEST_URL}'
    try:
        with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT) as resp:
            r = json.loads(resp.read())
            delay = r.get('delay', -1)
            return (name, delay)
    except Exception:
        return (name, 'ERR')

def get_all_nodes():
    with urllib.request.urlopen(f'{MIHOMO_API}/proxies') as resp:
        data = json.loads(resp.read())
    nodes = []
    for name, info in data['proxies'].items():
        ptype = info.get('type', '')
        if ptype in ('Direct', 'Reject', 'Compatible', 'Selector', 'URLTest', 'LoadBalance', 'Fallback'):
            continue
        nodes.append(name)
    return nodes

def pick_best(results):
    ok = [(n, d) for n, d in results if isinstance(d, int) and d >= 0]
    if not ok:
        return None
    return min(ok, key=lambda x: x[1])

def switch_node(name, selector='火箭云'):
    encoded = urllib.parse.quote(name, safe='')
    req = urllib.request.Request(
        f'{MIHOMO_API}/proxies/{urllib.parse.quote(selector, safe="")}',
        data=json.dumps({'name': name}).encode(),
        headers={'Content-Type': 'application/json'},
        method='PUT'
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 204
    except Exception:
        return False

if __name__ == '__main__':
    nodes = get_all_nodes()
    print(f'测试 {len(nodes)} 个节点...', file=sys.stderr)

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        results = list(ex.map(test_node, nodes))

    for name, delay in sorted(results, key=lambda x: (isinstance(x[1], str), x[1] if isinstance(x[1], int) else 999999)):
        if isinstance(delay, str):
            print(f'{name:40s} 超时/失败')
        else:
            print(f'{name:40s} {delay:5d}ms')

    best = pick_best(results)
    if best:
        name, delay = best
        print(f'\n最优节点: {name} ({delay}ms)')
        if switch_node(name):
            print('已切换至最优节点')
        else:
            print('切换失败')
    else:
        print('\n所有节点均超时，建议直连（DIRECT）')
```

**第三步：验证外网是否恢复**
```bash
curl -x http://127.0.0.1:7890 -s -o /dev/null -w "%{http_code} %{time_total}s" --connect-timeout 10 https://www.google.com
```

**第四步：所有节点都不通 → 走直连**
```bash
curl -s -X PUT http://127.0.0.1:9090/proxies/火箭云 \
  -H 'Content-Type: application/json' \
  -d '{"name":"DIRECT"}'
```

### 常见坑

| 现象 | 原因 | 修复 |
|------|------|------|
| Hysteria2 节点延迟检测通但实际不通 | Go 运行时解析到 IPv6，但机器 IPv6 不通 | /etc/hosts 写死代理服务器 IPv4 |
| SS 节点全部超时 | GFW 封了 TCP 出站 | 换 UDP 型节点（Hysteria2） |
| 节点切换后不生效 | mihomo 缓存问题 | `sudo systemctl restart mihomo` |
| 所有节点超时 + 订阅 403 | 订阅 token 过期 | 联系服务商更新订阅 |

### 代理服务器 IPv4 地址（写死 /etc/hosts）

更新订阅后需重新解析：

```bash
for h in hk1 jp1 sg1 kr1; do
  ip=$(dig ${h}.ikookook.com A +short | head -1)
  [ -n "$ip" ] && echo "$ip ${h}.ikookook.com"
done
for h in mm n1 n2 tt x2; do
  ip=$(dig ${h}.good2026.com A +short | tail -1)
  [ -n "$ip" ] && echo "$ip ${h}.good2026.com"
done
```

## 公司内网（飞连/corplink）

### 重连流程

```bash
# 1. 停旧进程
kill $(pgrep -f corplink-rs) 2>/dev/null
# 2. 清 cookie
rm -f /etc/corplink/corplink_cookies.json
# 3. 启动（PTY 模式，等待扫码）
sudo corplink-rs /etc/corplink/config.json
# 4. 拿到飞书链接发给用户 → 用户授权 → 按 Enter
# 5. 验证
ip addr show corplink
curl -s --max-time 5 -o /dev/null -w "Jira: %{http_code}\n" http://jira.qima-inc.com
```

### 关键警告

- **⛔ 永远不要删除或替换默认路由**（`ip route del default`），会断掉所有外网
- 飞连 VPN **只转发内网 IP 段**，不支持外网翻墙
- 密码登录不兼容有赞飞连，只能用飞书扫码
- corplink-rs 必须用 PTY 模式运行，管道运行 stdin 被关闭会直接退出
- 旧 cookie 会失效，每次重连先删 cookie

## 验证命令

```bash
# 外网
curl -x http://127.0.0.1:7890 -s --max-time 5 https://www.google.com

# 内网
curl -s --max-time 5 http://jira.qima-inc.com

# 本地网络
curl -s --max-time 5 https://www.baidu.com
```
