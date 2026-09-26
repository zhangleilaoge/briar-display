# 文件管理（原图床）

页面 `/briar/files`（旧 `/briar/images/*` 重定向至此），API `/api/files`。

## 相关文件

| 文件 | 作用 |
| :--- | :--- |
| `packages/briar-node/src/routes/files.ts` | 文件夹 CRUD（含 isPrivate 设/取消隐私）、列表/详情/文本预览代理 |
| `packages/briar-node/src/routes/fileUpload.ts` | 上传三件套：precheck / cos-sign / confirm |
| `packages/briar-node/src/routes/filesShared.ts` | 共享 helper |
| `packages/briar-node/src/routes/filePrivacy.ts` | 隐私空间 API（`/api/files/privacy`）：status/setup/change/send-code/reset/unlock；导出隐私链路网关 helper（`guardPrivateChain`/`hasPrivacyUnlock`/`privacyLocked`）供 files/fileUpload 复用 |
| `packages/briar-node/src/services/privacyService.ts` | 隐私空间服务：账户级安全密码（bcrypt，`users.security_password_hash`）+ 邮箱验证码双通道解锁，签 12h JWT（purpose=`files-privacy`）；`isPrivateChain`/`privateScopeFolderIds` 隐私链路判定；unlock 内存限频 5 次/分钟/用户 |
| `packages/briar-display/src/api/files.ts` | 前端文件 API + cos-js-sdk-v5 分片直传封装 + 隐私空间 API |
| `packages/briar-node/src/services/fileModerationService.ts` | 图片封禁检测：定时扫描 CDN URL（403/451 判定被封）→ 删记录 + 清理 COS + 发站内信 |
| `packages/briar-node/src/jobs/scan-blocked-files.mjs` | 封禁扫描定时任务（cron 见 schedulerConfig，`BRIAR_SCAN_BLOCKED_CRON` 可覆盖） |

## 存储：双 bucket

- 公开桶 `BRIAR_TX_BUCKET_NAME`：前端静态资源和头像
- 私有读桶 `BRIAR_TX_PRIVATE_BUCKET_NAME`：用户文件（`files/` 前缀），**访问一律走后端签名 URL**（`cosService.signFileUrls`，8 天有效，读取时按 `filename` 现算，DB 留存的 `cdn_url`/`thumbnail_url` 裸 URL 不外发；签名 KeyTime 按 7 天窗口对齐（`KEYTIME_WINDOW`），同一窗口内含 PM2 重启后 URL 完全一致，浏览器缓存可跨部署存活，进程内缓存仅用于避免重复计算）
- 浏览器缓存：对象上传时写 `Cache-Control: max-age=2592000`（cosKey 带随机 id 内容不可变）；静态资源由 upload-cdn.ts 设一年 immutable；存量对象补 header 用 `bun run --filter @briar/scripts cos:cache-control`（幂等）

## 上传：前端分片直传 COS

`POST /api/files/precheck`（配额/去重/发 cosKey）→ cos-js-sdk-v5 `sliceUploadFile` 直传（分片签名由 `POST /api/files/cos-sign` 下发，仅放行 `files/{userId}/` 前缀）→ `POST /api/files/confirm` 写库。文件不经过 nginx/服务器，`client_max_body_size 10m` 不影响上传。

- 直传依赖 COS bucket CORS，一次性配置（覆盖双桶）：`make cos-cors`
- 存量文件从公开桶迁到私有桶：`make cos-migrate-files`（幂等，不删源桶）

## 视频封面

上传完成后客户端用 video+canvas 截首帧，直传为 `{cosKey去扩展名}.cover.jpg` 并在 confirm 时传 `thumbnailKey`；网格有封面用 `<img>`，存量无封面视频 fallback 到 `<video preload="metadata">`；删除文件/文件夹时连带删封面。

## 隐私文件夹

`folders.is_private=1` 的文件夹及其全部子孙构成隐私链路（禁止嵌套设隐私）。未持有解锁 token（`x-privacy-token` header，前端 sessionStorage `briar_files_privacy_token`，12h JWT）时：

- 链路内文件不签发 URL、不出现在列表/搜索（`excludeFolderIds`）
- precheck 去重命中链路文件按新文件上传
- 链路文件夹 previews 置空但始终返回 `isPrivate`
- 链路上写操作一律 403（响应体 `code=40301` 即 shared `PRIVACY_LOCKED_CODE`，前端拦截器清 token 并弹解锁框）

设/取消隐私走 `PATCH /api/files/folders/:id` 传 `isPrivate`（需已解锁 + 祖先/后代无 private）。链路内文件前端禁用详情预览、隐藏「预览/复制链接」；管理员查看他人文件不受隐私限制。

## 数据表

`files`（原 `images` 表改名）+ `folders`（嵌套文件夹，含 `is_private`），结构见 `src/db/migrate.sql`。

## 注意

- 封禁扫描（fileModerationService）必须签 URL 再 fetch：私有桶未签名恒 403，直接 fetch 裸 URL 会把全部图片误判为封禁并删除
