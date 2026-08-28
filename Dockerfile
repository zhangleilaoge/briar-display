# Briar Display 一体化镜像：@briar/display 静态产物 + @briar/node 后端
# 前端由后端 serveStatic 托管（见 packages/briar-node/src/index.ts），故单镜像即可

# ============ 构建阶段 ============
FROM oven/bun:1.2 AS build
WORKDIR /app

# 先拷依赖清单，利用层缓存（仅依赖变化时重装）
COPY package.json bun.lock ./
COPY patches/ ./patches/
COPY packages/briar-shared/package.json packages/briar-shared/
COPY packages/briar-display/package.json packages/briar-display/
COPY packages/briar-node/package.json packages/briar-node/
COPY packages/briar-scripts/package.json packages/briar-scripts/
COPY packages/briar-skills/package.json packages/briar-skills/

# bun 镜像无 node，根 postinstall（node scripts/remove-ssh2-native.mjs）会失败，
# 故 --ignore-scripts 跳过后用 bun 手动补跑；patchedDependencies 在 install 期应用，不受影响
RUN bun install --ignore-scripts
COPY scripts/remove-ssh2-native.mjs scripts/remove-ssh2-native.mjs
RUN bun scripts/remove-ssh2-native.mjs

# 源码与构建
COPY packages/ ./packages/
RUN bun run --filter @briar/shared build \
	&& bun run --filter @briar/display build \
	&& bun run --filter @briar/node build

# 版本指纹：镜像内无 .git，commit/branch 由 CI 通过 build-arg 传入
ARG BRIAR_COMMIT=unknown
ARG BRIAR_BRANCH=unknown
ENV BRIAR_GIT_COMMIT=$BRIAR_COMMIT \
	BRIAR_GIT_BRANCH=$BRIAR_BRANCH \
	BRIAR_BUILDER=docker
RUN bun packages/briar-scripts/scripts/write-version.ts packages/briar-node/dist \
	&& bun packages/briar-scripts/scripts/write-version.ts packages/briar-display/dist

# ============ 运行阶段 ============
# node:22-slim 对齐服务器生产版本（v22.22.1）
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 完整 node_modules：Bree 定时任务运行时依赖 tsx（tsx/esm/api）与 src TS 源码，不能裁剪。
# bun 隔离布局下 packages/*/node_modules 是指向根 node_modules/.bun store 的相对符号链接，
# 保持 repo 目录布局原样拷贝即可保证链接有效。
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/briar-shared/package.json ./packages/briar-shared/package.json
COPY --from=build /app/packages/briar-shared/node_modules ./packages/briar-shared/node_modules
COPY --from=build /app/packages/briar-shared/dist ./packages/briar-shared/dist
COPY --from=build /app/packages/briar-node/package.json ./packages/briar-node/package.json
COPY --from=build /app/packages/briar-node/node_modules ./packages/briar-node/node_modules
COPY --from=build /app/packages/briar-node/dist ./packages/briar-node/dist
COPY --from=build /app/packages/briar-node/jobs ./packages/briar-node/jobs
COPY --from=build /app/packages/briar-node/src ./packages/briar-node/src
# 前端产物落位到 web/（生产环境优先读取路径）
COPY --from=build /app/packages/briar-display/dist ./packages/briar-display/web
# jobs 的 findRepoRoot 靠 bun.lock 定位仓库根
COPY bun.lock package.json ./

EXPOSE 3888
CMD ["node", "packages/briar-node/dist/index.js"]
