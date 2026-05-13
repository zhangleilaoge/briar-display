# Jobs 目录

此目录下的 `.mjs` 文件是定时任务脚本，由 `bree` 调度器执行。

**注意：不要直接修改 `packages/briar-node/jobs/` 或 `packages/briar-node/dist/jobs/` 下的文件。**

这两个目录是构建时由 `tsup` 自动从 `src/jobs/` 复制生成的，每次 `bun run --filter @briar/node build` 都会覆盖。

如需修改任务逻辑，请编辑 `src/jobs/` 下的源文件，然后重新构建。
