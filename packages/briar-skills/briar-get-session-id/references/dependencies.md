# 运行时依赖

## 必需技能

### `zan-log-query`

- 用途：天网日志查询的唯一支持入口。
- 自动探测位置（按顺序）：`ZAN_LOG_QUERY_SKILL_DIR`、`~/.codex/skills/zan-log-query`、`~/.agents/skills/zan-log-query`、`~/Documents/gitlab/zan-skills/skills/zan-log-query`。
- 强制操作：完整阅读其 `SKILL.md`，并在查询前执行 `scripts/pre-execute.sh zan-log-query`（主脚本自动执行）。
- 使用命令：`scripts/logs.py --raw`。
- 鉴权依赖：`opscli` 登录态（`opscli login`，token 存于 `~/.opscli/config.json`）。
- 数据限制：天网只保留最近 7 天日志。

缺少该技能时应停止执行，提示用户安装或提供 `zan-log-query`，不得替换为未声明的日志接口。

### `zan-dubbo-invoke`

- 用途：店铺元数据和导购 Dubbo 查询的唯一支持入口。
- 安装命令：`helm skill install zan-dubbo-invoke -g`。
- 自动探测位置（按顺序）：`ZAN_DUBBO_INVOKE_SKILL_DIR`、`~/.codex/skills/zan-dubbo-invoke`、`~/.agents/skills/zan-dubbo-invoke`、`~/.claude/skills/zan-dubbo-invoke`、`~/.kimi-code/user-skills/zan-dubbo-invoke`、`~/.helm/registry/skills/zan-dubbo-invoke`。
- 强制操作：完整阅读其 `SKILL.md`，并在调用前执行 `scripts/pre-execute.sh zan-dubbo-invoke`（主脚本自动执行）。
- 使用命令：`scripts/dubbo_query.py <接口全限定方法名> --args '<JSON数组>' --env prod`。
- 鉴权依赖：由该技能管理 Funeng/Ticket 登录态，必要时从用户的 Chrome CAS 会话刷新；Ticket 平台 session 失效时需要在 Chrome 手动访问 https://ticket.qima-inc.com 完成登录。
- 安全边界：预发和生产环境只能调用只读查询方法。

缺少该技能时应停止执行，提示用户安装，不得改用直接 HTTP 网关。

## 必需内部服务

- 通过 `zan-log-query` 查询天网日志。
- columbus 白名单（仅 `--page-key` 模式）：`https://columbus.prod.qima-inc.com/columbus/getWhiteList`，需要本机 Chrome 的 CAS 登录态。
- 导购 RPC：`com.youzan.guide.api.service.shoppingguide.ShoppingGuideReadApiService.getShoppingGuide`
- 店铺元数据 RPC：`com.youzan.shopcenter.shop.service.ShopMetaReadService.queryShopMetaInfo`

以上接口均由 `zan-dubbo-invoke` 在 `prod` 环境执行只读查询，需要能够访问有赞内部网络或 VPN。

## 必需本地环境

- Python 3.10+（脚本使用 `X | None` 类型语法）。推荐使用 `uv run --system-certs --python 3.12 --with requests --with browser_cookie3 --with truststore` 一次性提供解释器和依赖。
- `zan-log-query` 所需的 `opscli`。
- `requests` 和 `browser_cookie3`（白名单拉取 + Dubbo 鉴权）；`truststore`（非系统 Python 下注入系统钥匙串信任源，解决公司证书代理导致的校验失败）。
- 如果依赖安装在其他解释器中，通过 `--zan-dubbo-python` 或 `ZAN_DUBBO_PYTHON` 指定。
- 当需要刷新鉴权或拉取白名单时，需要 Chrome CAS 登录态和 macOS Keychain 权限（`browser_cookie3` 读取 Chrome Cookie）。
- 本地单实例锁依赖 POSIX `fcntl`。

不需要 Dify 运行时、直接导购网关、浏览器自动化或导出的 DSL 文件。

## 构建时依赖

- 创建、校验、更新和打包依赖技能时，可使用 Helm 管理的 `skill-creator`；普通运行本技能不需要。
