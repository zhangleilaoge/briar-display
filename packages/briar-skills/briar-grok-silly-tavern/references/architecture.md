# Architecture — grok2api + SillyTavern

## 组件职责

| 组件 | 语言/运行时 | 监听 | 职责 |
|------|-------------|------|------|
| SillyTavern | **Node.js only**（≥20） | `:8001`（本 skill 约定） | 角色卡、聊天 UI、Chat Completion 客户端 |
| grok2api | **Go**（chenyme/grok2api） | `:8000` | 把 grok.com Web SSO 账号池暴露为 OpenAI 兼容 `/v1`；Admin 导入 SSO、签发 client key |
| Kimi WebBridge | CDP 桥 | 历史上 `127.0.0.1:10086` | 从已登录的 grok.com 配置文件读 `sso` / `sso-rw` cookie |

**明确：SillyTavern 不依赖 Go。Go 工具链只为编译/运行 grok2api。**

## 数据流

1. 用户浏览器登录 grok.com → 产生 cookie `sso`、`sso-rw`
2. WebBridge/CDP 导出上述 cookie（不经 LLM 对话粘贴）
3. grok2api Admin「SSO import」→ 账号池 active
4. Admin 创建 client key `g2a_...`
5. ST Custom OpenAI：`base=http://127.0.0.1:8000/v1`，model=`grok-chat-fast`

## 端口冲突

SillyTavern 上游默认端口常为 **8000**，与 grok2api 冲突。本 skill：

- grok2api → **8000**
- SillyTavern → **8001**（`start_sillytavern.sh` 通过环境变量或启动参数设置）

## 模型选择（实验室笔记）

| Model | 实验室观察 |
|-------|------------|
| `grok-chat-fast` | 可用（曾 200）— **优先** |
| `grok-chat-auto` | 易 503（account pool） |
| `grok-chat-expert` | 易 503（account pool） |

## 安装路径偏好

1. **ST (A)** SillyTavern-Launcher：`install.sh` + `launcher.sh`（官方 Mac 文档）
2. **ST (B)** 直接 `SillyTavern` `release` 分支 + `npm install` + `./start.sh` — 若 `$HOME/Documents/github/SillyTavern` 已存在则复用
3. **grok2api**：`git clone` + **native `go build`**（优于 Docker）

## 环境变量

| 变量 | 默认 | 含义 |
|------|------|------|
| `ST_HOME` / `BRIAR_ST_HOME` | `$HOME/Documents/github/SillyTavern` | ST 源码树（工作路径：直接 clone+npm） |
| `BRIAR_ST_PORT` | `8001` | ST `config.yaml` port |
| `Grok2API_HOME` / `BRIAR_G2A_HOME` | `$HOME/Documents/github/grok2api` | grok2api 源码树 |
| `BRIAR_G2A_PORT` | `8000` | `./grok2api --config config.yaml` |
| pid/log | `$Grok2API_HOME/grok2api.pid` / `*.nohup.log` | nohup 托管 |
| pid/log | `$ST_HOME/sillytavern.pid` / `*.nohup.log` | nohup 托管 |
| `BRIAR_WEBBRIDGE_CDP` | `http://127.0.0.1:10086` | CDP endpoint |
| `BRIAR_G2A_KEY_FILE` | `$HOME/.config/briar-skills/grok2api-client.key` | client key 文件（0600） |

## UNVERIFIED

端到端「打开 ST 就能聊」**尚未**由本 skill 验证。见 `SKILL.md` 对应章节。
