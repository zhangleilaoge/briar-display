# Briar Hermes Skills

给 Hermes Agent 用的技能集合，沉淀系统化知识，碎片知识留在 notes。

## 技能列表

| 技能 | 说明 | 来源 |
|------|------|------|
| `network-proxy` | 外网代理（mihomo）+ 公司内网（飞连）配置与故障排查 | network-setup.md, vpn-reconnect.md, pitfall/mihomo-ipv6.md |
| `coding-agents` | 编码代理工具（KimiCode/MimoCode）使用指南 | code-agents.md, coding-agents-comparison.md |
| `obsidian` | Obsidian 知识库管理（替代 ~/notes/，结构化 markdown vault） | — |

## 开发流程

**所有 skill 先在本仓库调整、提交、push，最后再同步到 hermes。**

```bash
# 1. 在 briar-hermes-skills 目录修改 skill
vim network-proxy/SKILL.md

# 2. 提交到本仓库
git add .
git commit -m "feat(network-proxy): xxx"
git push origin master

# 3. 最后同步到 hermes
cp -r network-proxy ~/.hermes/skills/
cp -r coding-agents ~/.hermes/skills/
cp -r obsidian ~/.hermes/skills/note-taking/
```

**禁止**直接修改 `~/.hermes/skills/` 然后反向同步，hermes 是消费端不是源头。

## 使用方式

```bash
# 从本仓库导入到 hermes
cp -r ./network-proxy ~/.hermes/skills/
cp -r ./coding-agents ~/.hermes/skills/
```

或：

```bash
hermes skill import ./network-proxy
hermes skill import ./coding-agents
```

## 沉淀原则

- **系统化知识**进 skill：有完整流程、有坑、有验证步骤
- **碎片知识**留在 notes：临时记录、易变信息、凭据
- **不重复**：skill 是权威来源，notes 只留引用
- **skill 导入后删除 notes 重复内容**：skill 成为唯一权威来源后，对应的 notes 文件直接删除，避免双源维护
