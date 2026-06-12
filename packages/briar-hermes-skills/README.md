# Briar Hermes Skills

给 Hermes Agent 用的技能集合，沉淀系统化知识，碎片知识留在 notes。

## 技能列表

| 技能 | 说明 | 来源 |
|------|------|------|
| `network-proxy` | 外网代理（mihomo）+ 公司内网（飞连）配置与故障排查 | network-setup.md, vpn-reconnect.md, pitfall/mihomo-ipv6.md |
| `coding-agents` | 编码代理工具（KimiCode/MimoCode）使用指南 | code-agents.md, coding-agents-comparison.md |

## 使用方式

```bash
# 导入到 hermes
hermes skill import ./network-proxy
hermes skill import ./coding-agents
```

或手动复制到 `~/.hermes/skills/`。

## 沉淀原则

- **系统化知识**进 skill：有完整流程、有坑、有验证步骤
- **碎片知识**留在 notes：临时记录、易变信息、凭据
- **不重复**：skill 是权威来源，notes 只留引用
