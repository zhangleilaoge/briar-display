---
name: briar-readme-ai
description: >
  AI 项目认知协议：管理 readme.ai.md，让 Agent 优先读取机器友好的项目真相源。
  触发场景：
  1. Agent 进入任何项目目录开始工作前 → 触发【认知项目】
  2. 用户要求"更新项目认知"、"刷新 readme.ai" → 触发【重写认知】
  3. 用户要求"初始化项目认知"、"生成 readme.ai" → 触发【初始化认知】
---

# briar-readme-ai: AI 项目认知协议

## 核心理念

`readme.ai.md` 是**机器优先的项目真相源**（Single Source of Truth for Agents）。

- 人类读 `README.md`，Agent 读 `readme.ai.md`
- `README.md` 可能年久失修，`readme.ai.md` 必须保持与代码同步
- Agent 在进入项目后的**第一件事**就是读取或初始化 `readme.ai.md`

---

## 服务配置

默认服务地址：
```bash
export README_AI_BASE_URL="${README_AI_BASE_URL:-http://localhost:3888}"
```

如需覆盖（例如远程服务器）：
```bash
export README_AI_BASE_URL="https://your-server.com"
```

---

## 行为一：认知项目（read / 默认行为）

**触发条件**：Agent 进入任何项目目录，准备开始工作前。

### 流程

1. **检查本地文件**
   ```bash
   PROJECT_PATH="$(pwd)"
   if [ -f "$PROJECT_PATH/readme.ai.md" ]; then
       echo "本地存在 readme.ai.md"
   fi
   ```

2. **查询服务端**
   ```bash
   curl -s "$README_AI_BASE_URL/api/readme-ai?projectPath=$PROJECT_PATH"
   ```

3. **决策矩阵**

   | 本地 | 服务端 | Agent 行为 |
   |------|--------|-----------|
   | 有   | 有     | 对比时间戳，取最新者作为上下文；如有差异提示用户 |
   | 有   | 无     | 将本地内容 `POST /api/readme-ai/init` 同步到服务端，然后继续 |
   | 无   | 有     | 将服务端内容写入本地 `readme.ai.md`，然后读取作为上下文 |
   | 无   | 无     | 触发【初始化认知】（见行为三） |

4. **注入上下文**

   读取到的 `readme.ai.md` 内容必须作为**最高优先级上下文**注入到后续所有操作中。

### 脚本

```bash
./packages/briar-skills/briar-readme-ai/scripts/briar-readme-ai.sh read
```

---

## 行为二：重写认知（rewrite）

**触发条件**：
- 用户说"更新项目认知"、"刷新 readme.ai"、"代码变了，同步一下"
- Agent 完成大量代码重构后，主动判断需要同步

### 流程

1. **重新扫描项目**（Agent 自行分析代码）
2. **生成新的 `readme.ai.md` 内容**
3. **更新本地文件**
   ```bash
   echo "$NEW_CONTENT" > "$(pwd)/readme.ai.md"
   ```
4. **同步到服务端**
   ```bash
   ./packages/briar-skills/briar-readme-ai/scripts/briar-readme-ai.sh rewrite
   ```

### 重写内容规范

`readme.ai.md` 必须包含以下板块：

```markdown
# <项目名>

## 业务归属
- 所属业务域：
- 核心用户场景：
- 上下游依赖：

## 技术架构
- 技术栈：
- 核心框架/库：
- 部署方式：

## 目录结构
- src/
  - ...（关键目录说明）

## 关键模块
### <模块名>
- 职责：
- 入口文件：
- 核心类型：

## 数据流
（简要描述请求/数据如何流动）

## 注意事项
（Agent 容易踩的坑、历史包袱、特殊约定）

## 最近变更
（由 rewrite 时自动追加）
```

---

## 行为三：初始化认知（init）

**触发条件**：
- 新项目首次被 Agent 接触
- 本地和服务端都不存在 `readme.ai.md`

### 流程

1. **Agent 扫描项目代码**
   - 读取 `package.json`、`tsconfig.json`、`AGENTS.md`、`README.md` 等元文件
   - 扫描 `src/` 或 `app/` 目录结构
   - 识别技术栈、框架、核心依赖
   - 查找路由/API 定义、数据库模型等架构信息

2. **生成 `readme.ai.md` 草稿**
   - 遵循【重写内容规范】的板块结构
   - 不确定的内容标记为 `TODO(Agent): 待确认`

3. **保存到本地**
   ```bash
   echo "$CONTENT" > "$(pwd)/readme.ai.md"
   ```

4. **提交到服务端**
   ```bash
   ./packages/briar-skills/briar-readme-ai/scripts/briar-readme-ai.sh init
   ```

5. **反馈给用户**
   > "已为项目初始化 readme.ai.md，保存在 $(pwd)/readme.ai.md 并同步到服务端。以下内容基于代码扫描生成，请确认关键信息是否准确："
   > （列出 TODO 项和不确定的内容）

---

## 行为四：删除认知（delete）

**触发条件**：用户要求"删掉这个项目的 readme.ai"、"重置认知"。

```bash
./packages/briar-skills/briar-readme-ai/scripts/briar-readme-ai.sh delete
```

---

## API 速查

| 行为 | 方法 | 路径 | 参数 |
|------|------|------|------|
| 读取 | GET | `/api/readme-ai?projectPath=` | `projectPath` 或 `projectName` |
| 初始化 | POST | `/api/readme-ai/init` | `{ projectPath, projectName, content, codeHash? }` |
| 重写 | POST | `/api/readme-ai/rewrite` | `{ projectPath, content, codeHash? }` |
| 删除 | DELETE | `/api/readme-ai?projectPath=` | `projectPath` |

所有接口均为**公开接口**，无需认证即可调用。

---

## Agent 必须遵守的约定

1. **优先读取**：进入项目目录后，**必须先处理 readme.ai.md**，再执行用户要求的其他操作
2. **透明同步**：本地 `readme.ai.md` 与服务端必须保持双向同步
3. **用户确认**：init 和 rewrite 后，必须将生成的内容摘要展示给用户，并标注不确定项
4. **不要猜测**：readme.ai.md 中的信息必须有代码依据，不确定的写 `TODO`，不要编造
