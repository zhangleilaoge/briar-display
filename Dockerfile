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
# BRIAR_TX_BUCKET_DOMAIN：astro.config.mjs 构建期读取，生成静态资源 CDN 前缀
# （只是桶域名，非敏感信息；不传则资源由后端容器直接托管，功能正常但不走 CDN）
ARG BRIAR_TX_BUCKET_DOMAIN=""
ENV BRIAR_TX_BUCKET_DOMAIN=$BRIAR_TX_BUCKET_DOMAIN
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

# ============ 生产依赖阶段（独立于构建依赖，镜像瘦身） ============
# 全量 node_modules 约 1G（含 astro/vite 等构建期 devDeps），运行时用不到；
# 生产安装只留后端运行 + Bree jobs（tsx tsImport src TS 源码）所需依赖
FROM oven/bun:1.2 AS runtime-deps
WORKDIR /app

COPY package.json bun.lock ./
COPY patches/ ./patches/
COPY packages/briar-shared/package.json packages/briar-shared/
COPY packages/briar-display/package.json packages/briar-display/
COPY packages/briar-node/package.json packages/briar-node/
COPY packages/briar-scripts/package.json packages/briar-scripts/
COPY packages/briar-skills/package.json packages/briar-skills/
COPY scripts/remove-ssh2-native.mjs scripts/remove-ssh2-native.mjs
RUN bun install --production --ignore-scripts \
	&& bun scripts/remove-ssh2-native.mjs

# ============ 运行阶段 ============
# node:22-slim 对齐服务器生产版本（v22.22.1）
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 生产依赖（含 tsx）：Bree 定时任务运行时 tsImport src TS 源码，需要 packages/briar-node/src。
# bun 隔离布局下 packages/*/node_modules 是指向根 node_modules/.bun store 的相对符号链接，
# 保持 repo 目录布局原样拷贝即可保证链接有效。
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=runtime-deps /app/packages/briar-shared/node_modules ./packages/briar-shared/node_modules
COPY --from=runtime-deps /app/packages/briar-node/node_modules ./packages/briar-node/node_modules
COPY --from=build /app/packages/briar-shared/package.json ./packages/briar-shared/package.json
COPY --from=build /app/packages/briar-shared/dist ./packages/briar-shared/dist
COPY --from=build /app/packages/briar-node/package.json ./packages/briar-node/package.json
COPY --from=build /app/packages/briar-node/dist ./packages/briar-node/dist
COPY --from=build /app/packages/briar-node/jobs ./packages/briar-node/jobs
COPY --from=build /app/packages/briar-node/src ./packages/briar-node/src
# 前端产物落位到 web/（生产环境优先读取路径）
COPY --from=build /app/packages/briar-display/dist ./packages/briar-display/web
# jobs 的 findRepoRoot 靠 bun.lock 定位仓库根
COPY bun.lock package.json ./

EXPOSE 3888
CMD ["node", "packages/briar-node/dist/index.js"]
