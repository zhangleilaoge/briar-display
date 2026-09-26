# 媒体解析 / 磁力查询

工具箱两个免登录工具，API 分别为 `/api/media`、`/api/magnet`，均 IP 限频 + 超管豁免。

## 媒体解析（`/api/media`）

`packages/briar-node/src/routes/media.ts`：IP 限频 parse 6/min、proxy 120/min。

- `POST /parse` 支持平台：
  - **小红书**：转发 catsapi，失败回退自研解析 `services/xhsMediaService.ts`（catsapi 2026-09 起持续 502）
  - **抖音**：自研解析 `services/douyinMediaService.ts`
  - **微信公众号文章**：自研解析 `services/wechatMediaService.ts`
  - **B站**：自研解析 `services/bilibiliMediaService.ts`
  - **X/Twitter**：fxtwitter 公共 API
- `GET /proxy` 媒体代理（白名单 xhscdn/qpic/tc.qq/douyin 系/zjcdn/twimg/bilivideo/hdslb 等），旁路缓存——inline 预览透传 Range 不缓存，下载（非 inline）拉全量 tee 到 COS 公有桶，hit 302 直发（文件名在对象 key 末段），上游 403 时把对应解析记录标记 stale（保留行做历史记录，「重新解析」会拉新签名）
- `GET/DELETE /history` 解析历史（需登录，按 `u:{userId}` 维度，跨设备互通；DELETE 带 url 删单条、不带清空，连带清对应媒体缓存）。前端登录用户走此接口，访客仍用 localStorage
- twimg 国内服务器不可达：前端对 twimg 直连（CORS 开放，需访客有梯子），代理仅海外环境可用

### 缓存（`services/mediaCacheService.ts`）

- `media_parse_cache` 按人（u:{userId}/ip:{IP}）LRU 10 条存解析结果，兼作登录用户的解析历史表（`listParseHistory`/`deleteParseHistory`，stale 列标记媒体地址已被上游拒绝——stale 行不命中缓存但保留在历史里，点历史重解析即复位；淘汰/删历史连带清对应媒体）
- 抖音签名 URL 时效不足半小时，缓存超 10 分钟视为失效
- `media_cache` 记录 COS 旁路缓存（每条解析记录累计 ≤50MB 才缓存）
- `cleanupExpiredMedia` 清 7 天前媒体（解析结果保留）；定时任务 `jobs/cleanup-media-cache.mjs`（每日 05:23，`BRIAR_CLEANUP_MEDIA_CRON` 可覆盖）

### 小红书（`services/xhsMediaService.ts`，catsapi 兜底）

xhslink 短链手动跟 302（老路径 discovery/item 会二次跳信息流丢笔记 ID，须改写为 explore；跳到裸首页=链接失效）→ GET 笔记页 HTML 抠 `window.__INITIAL_STATE__`（裸 undefined 字面量需替换再 JSON.parse）。

- **移动端 UA 优先**（noteData.data.noteData，能出网页端受限笔记），每次请求带本地生成的 fresh `a1` 游客 Cookie（generateA1：时间戳 hex+随机串+crc32），被概率风控（/404/sec_ 安全页）换 a1 递增间隔重试 3 次再换桌面端（noteDetailMap）兜底
- **请求头保持极简**（仅 UA+Cookie，Accept/Accept-Language 等额外头反而提高拦截率）
- 图片用 `imageList[].fileId` 裸 key + `?imageView2/2/format/jpg`（sns-na-i1.xhscdn.com，免签名**无水印**原图；url/urlDefault 场景图带平台水印仅兜底）、实况 stream.h264 HD 档、视频 video.media.stream.h264 HD 档
- 硬门槛 xsec_token（短链跳转自带，过期/缺失被拦）
- 风控指纹细节见 [pitfalls.md](pitfalls.md) #8

### 抖音（`services/douyinMediaService.ts`）

短链手动跟 302 取 aweme_id → ttwid 游客凭证 + a_bogus 签名 → `douyin.com/aweme/v1/web/aweme/detail/`。

- 视频 play_addr 即无水印；图集 images[].url_list；动态照片 images[].video.play_addr；音轨 music.play_url
- Argus 风控概率拦截（403 Uifid/空 body）时换 fresh ttwid 重试 3 次；审核中/已删除（filter_reason）报「作品不存在、已删除或仅作者本人可见」
- 签名实现：`lib/sm3.ts`（国密 SM3，OpenSSL 测试向量有单测）+ `lib/aBogus.ts`（SDK 1.0.1.5 变体盐 "cus"，与 Evil0ctal abogus.py 逐字节对齐，有黄金回归测试；UA 与 UA_CODE 绑定勿单改）

### 微信公众号（`services/wechatMediaService.ts`）

正则解析 HTML：og:title/author 元信息、图片消息 `picture_page_info_list` 的 cdn_url + 实况图 format_info 取最大档、图文 `#js_content` img、视频 videoplayer 二次请求取 url_info。

### B站（`services/bilibiliMediaService.ts`）

b23.tv 短链跟 302 → BV/av 号 → `web-interface/view` 拿标题/UP主/封面/分P → `player/playurl` 取流（优先 html5 通道 muxed mp4 免登录 720P，无 durl 回退 DASH 视频/音频分离 1080P）。播放地址签名时效约 30 天，解析缓存不做短时效处理；bilivideo CDN 只校验浏览器 UA、不校验 Referer，代理直连均可。

## 磁力查询（`/api/magnet`）

`packages/briar-node/src/routes/magnet.ts`：IP 限频 6/min。

`POST /parse` 归一化输入（magnet 40 位 hex 统一小写 / 裸 hash 补全为 magnet / ed2k 原样）后转发 whatslink.info 公开 API（`GET /api/v1/link?url=`，浏览器 UA）。首解析上游常 500（后台抓 DHT 元数据），最多重试 3 次。返回名称/大小/文件数/fileType/截图列表（截图直链 whatslink.info/image，无防盗链，前端 `referrerPolicy="no-referrer"` 直接展示）。
