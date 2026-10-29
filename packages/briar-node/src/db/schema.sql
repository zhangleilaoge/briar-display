-- ============================================================
-- schema.sql — 数据库结构唯一事实来源（完整、幂等的目标态 schema，与线上一致）
-- 执行入口（均按 schema.sql → migrate.sql 顺序执行）：
--   1. 从零建库：make db-setup（src/db/setup.ts）
--   2. 每次部署：scripts/deploy.sh（mysql briar_display < schema.sql，再 < migrate.sql）
--   3. 手动：bun run --filter @briar/node db:migrate（src/db/migrate.ts）
-- 约定：
--   1. 只放 CREATE TABLE IF NOT EXISTS（含全部列、索引、外键）与幂等种子数据（ON DUPLICATE KEY），
--      全新库执行一次即得与线上完全相同的结构。
--   2. 任何结构变更（加列/改列/加索引/新表）都必须同步修改本文件里对应的 CREATE TABLE；
--      存量库需要的 ALTER / 数据修补写进 migrate.sql（临时，上线后可清空）。
--   3. 不写一次性 UPDATE/DELETE、数据回填、DROP 旧表等；那些属于 migrate.sql。
--   4. 用户合并 schema 守卫（services/userMerge/schemaGuard.test.ts）扫描本文件中引用用户的列，
--      新增此类列必须在 services/userMerge/registry.ts 中认领或列入忽略清单。
-- MySQL 8.0+
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS briar_display
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE briar_display;

-- ============================================================
-- 全量建表（目标态）
-- 全新库执行即得完整结构；存量库靠 IF NOT EXISTS / ON DUPLICATE KEY 幂等跳过
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY COMMENT '用户唯一标识',
  name VARCHAR(100) NOT NULL COMMENT '用户名',
  email VARCHAR(255) NOT NULL COMMENT '邮箱（未删除用户内唯一，见 uk_email_active）',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  has_password TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否设置过可用的登录密码（Google 注册的账号为 0，重置密码后为 1）',
  security_password_hash VARCHAR(255) NULL COMMENT '隐私空间安全密码哈希',
  google_sub VARCHAR(64) NULL UNIQUE COMMENT 'Google OAuth subject（openid sub）；已迁移到 user_identities，旧列保留但不再读写',
  token_version INT NOT NULL DEFAULT 0 COMMENT '令牌版本号：+1 吊销该用户全部已签发登录 token',
  avatar VARCHAR(500) COMMENT '头像 CDN URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  email_active VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED COMMENT '未删除时=email，删除后为 NULL（唯一约束只作用于未删除用户）',

  UNIQUE KEY uk_email_active (email_active),
  INDEX idx_email (email),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 通用验证码表（支持邮箱验证、密码重置等多种场景）
CREATE TABLE IF NOT EXISTS verification_codes (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  target VARCHAR(255) NOT NULL COMMENT '目标（邮箱地址等）',
  type VARCHAR(50) NOT NULL COMMENT '验证码类型（reset_password、email_verification等）',
  code VARCHAR(10) NOT NULL COMMENT '验证码',
  is_used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
  used_at TIMESTAMP NULL COMMENT '使用时间',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  INDEX idx_target (target),
  INDEX idx_target_type (target, type),
  INDEX idx_type (type),
  INDEX idx_expires_at (expires_at),
  INDEX idx_is_used (is_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通用验证码表';

-- ============================================================
-- RBAC 权限系统表
-- ============================================================

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY COMMENT '角色唯一标识',
  name VARCHAR(50) NOT NULL COMMENT '角色标识（英文；未删除角色内唯一）',
  display_name VARCHAR(100) NOT NULL COMMENT '角色显示名称',
  description VARCHAR(500) COMMENT '角色描述',
  level INT NOT NULL DEFAULT 0 COMMENT '角色等级（数字越大权限越高）',
  is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统内置角色（不可删除）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  name_active VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, name, NULL)) STORED COMMENT '未删除时=name（唯一约束用）',
  UNIQUE KEY uk_name_active (name_active),
  INDEX idx_name (name),
  INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(36) PRIMARY KEY COMMENT '权限唯一标识',
  code VARCHAR(100) NOT NULL COMMENT '权限编码（如 admin:role:manage；未删除权限内唯一）',
  name VARCHAR(100) NOT NULL COMMENT '权限名称',
  description VARCHAR(500) COMMENT '权限描述',
  type ENUM('page', 'api') NOT NULL COMMENT '权限类型：page=页面访问，api=功能操作',
  module VARCHAR(50) NOT NULL COMMENT '所属模块（admin、system）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  code_active VARCHAR(100) GENERATED ALWAYS AS (IF(deleted_at IS NULL, code, NULL)) STORED COMMENT '未删除时=code（唯一约束用）',
  UNIQUE KEY uk_code_active (code_active),
  INDEX idx_code (code),
  INDEX idx_type (type),
  INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(36) NOT NULL COMMENT '角色 ID',
  permission_id VARCHAR(36) NOT NULL COMMENT '权限 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色-权限关联表';

-- 用户-角色关联表
CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(36) NOT NULL COMMENT '用户 ID',
  role_id VARCHAR(36) NOT NULL COMMENT '角色 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  PRIMARY KEY (user_id, role_id),
  INDEX idx_role_id (role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户-角色关联表';

-- 初始化 4 级角色
INSERT INTO roles (id, name, display_name, description, level, is_system) VALUES
  ('role-user', 'user', '普通用户', '可访问业务页面', 10, TRUE),
  ('role-moderator', 'moderator', '管理员', '可访问业务页面，预留扩展管理能力', 50, TRUE),
  ('role-admin', 'admin', '超级管理员', '拥有所有权限，可管理用户、角色和系统配置', 100, TRUE)
ON DUPLICATE KEY UPDATE display_name=display_name;

-- 初始化权限数据（新增权限在此追加，存量库靠 ON DUPLICATE KEY 幂等补全）
INSERT INTO permissions (id, code, name, type, module) VALUES
  -- 页面访问权限（默认开放，用于未来扩展）
  ('perm-page-admin', 'page:admin', '访问管理后台', 'page', 'admin'),
  ('perm-page-business', 'page:business', '访问业务页面', 'page', 'system'),
  -- 超级管理权限
  ('perm-admin-role-manage', 'admin:role:manage', '管理角色', 'api', 'admin'),
  ('perm-admin-permission-manage', 'admin:permission:manage', '管理权限', 'api', 'admin'),
  ('perm-admin-user-manage', 'admin:user:manage', '管理用户', 'api', 'admin'),
  ('perm-admin-user-role-assign', 'admin:user-role:assign', '分配用户角色', 'api', 'admin'),
  ('perm-page-sql-console', 'page:sql-console', '访问 SQL 控制台', 'page', 'admin'),
  ('perm-admin-sql-execute', 'admin:sql:execute', '执行 SQL', 'api', 'admin'),
  ('perm-admin-deploy-manage', 'admin:deploy:manage', '应用部署与证书', 'api', 'admin'),
  ('perm-admin-terminal-access', 'admin:terminal:access', 'SSH 控制台', 'api', 'admin')
ON DUPLICATE KEY UPDATE name=name;

-- ==================== 角色权限分配 ====================

-- 超级管理员：所有权限（全量 SELECT，新增权限自动覆盖）
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-admin', id FROM permissions
ON DUPLICATE KEY UPDATE role_id=role_id;

-- 管理员：业务页面访问（不含 admin:* 超级管理权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-moderator', id FROM permissions WHERE code IN (
  'page:business'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- 普通用户：业务页面访问
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-user', id FROM permissions WHERE code IN (
  'page:business'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- 超级管理员用户：启动时由 authService 自动分配 admin 角色
-- 详见 packages/briar-node/src/services/authService.ts

-- 请求日志表
CREATE TABLE IF NOT EXISTS request_logs (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  trace_id VARCHAR(36) NOT NULL COMMENT '请求追踪 ID',
  method VARCHAR(10) NOT NULL COMMENT 'HTTP 方法',
  path VARCHAR(500) NOT NULL COMMENT '请求路径',
  status INT NOT NULL COMMENT '响应状态码',
  duration INT NOT NULL COMMENT '请求耗时（ms）',
  ip VARCHAR(45) COMMENT '客户端 IP',
  user_agent VARCHAR(500) COMMENT 'User-Agent',
  user_id VARCHAR(36) COMMENT '用户 ID（已登录时）',
  request_params JSON COMMENT '请求参数（query + body，敏感字段脱敏）',
  response_body TEXT COMMENT '响应体（截断 2000 字符，敏感字段脱敏）',
  error_message TEXT COMMENT '错误信息（仅错误请求）',
  error_stack TEXT COMMENT '错误堆栈（仅未捕获异常）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_trace_id (trace_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status),
  INDEX idx_duration (duration),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='请求日志表';

-- ============================================================
-- 文件管理系统表
-- ============================================================

-- 文件夹表（支持嵌套）
CREATE TABLE IF NOT EXISTS folders (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '创建者 ID',
  name VARCHAR(255) NOT NULL COMMENT '文件夹名',
  parent_id VARCHAR(36) NULL COMMENT '父文件夹 ID（NULL 为根目录）',
  is_private TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否隐私文件夹',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  INDEX idx_user_parent (user_id, parent_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件夹表';

-- 文件表
CREATE TABLE IF NOT EXISTS files (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '上传者 ID',
  original_name VARCHAR(255) NOT NULL COMMENT '原始文件名',
  filename VARCHAR(255) NOT NULL COMMENT 'COS key: files/{userId}/{uuid}.{ext}',
  mime_type VARCHAR(100) NOT NULL COMMENT 'MIME 类型',
  size INT UNSIGNED NOT NULL COMMENT '文件大小（字节）',
  width INT UNSIGNED COMMENT '图片宽度',
  height INT UNSIGNED COMMENT '图片高度',
  cdn_url VARCHAR(500) NOT NULL COMMENT 'CDN 完整 URL',
  thumbnail_url VARCHAR(500) COMMENT '缩略图 URL（仅图片）',
  file_hash VARCHAR(64) COMMENT 'SHA-256 内容哈希（用于去重）',
  folder_id VARCHAR(36) NULL COMMENT '所属文件夹 ID（NULL 为根目录）',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_hash (user_id, file_hash),
  INDEX idx_folder_id (folder_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT files_ibfk_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件表';

-- SQL 控制台审计日志表
CREATE TABLE IF NOT EXISTS sql_audit_logs (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '执行者 ID',
  sql_text TEXT NOT NULL COMMENT '执行的 SQL 语句',
  sql_type ENUM('SELECT','INSERT','UPDATE','DELETE','DDL','OTHER') NOT NULL COMMENT '语句类型',
  status ENUM('success','error','timeout','blocked') NOT NULL COMMENT '执行状态',
  affected_rows INT COMMENT '影响行数',
  row_count INT COMMENT '返回行数（SELECT）',
  duration_ms INT COMMENT '执行耗时（ms）',
  error_message TEXT COMMENT '错误信息',
  ip VARCHAR(45) COMMENT '客户端 IP',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_sql_type (sql_type),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SQL 控制台审计日志';

-- 证书续期记录表
CREATE TABLE IF NOT EXISTS cert_renewal_logs (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  domain VARCHAR(255) NOT NULL COMMENT '证书域名',
  trigger_type ENUM('scheduled','manual') NOT NULL DEFAULT 'manual' COMMENT '触发方式',
  status ENUM('running','success','skipped','failed') NOT NULL DEFAULT 'running' COMMENT '执行状态',
  message TEXT COMMENT '结果信息或错误原因',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  finished_at TIMESTAMP NULL DEFAULT NULL COMMENT '结束时间',
  INDEX idx_started_at (started_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='证书续期记录';

-- 站内信
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '接收用户 ID',
  type VARCHAR(50) NOT NULL DEFAULT 'system' COMMENT '消息类型（system / file_blocked 等）',
  title VARCHAR(255) NOT NULL COMMENT '标题',
  content TEXT NOT NULL COMMENT '内容',
  read_at TIMESTAMP NULL DEFAULT NULL COMMENT '阅读时间（NULL 为未读）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  INDEX idx_user_read (user_id, read_at),
  INDEX idx_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站内信';

-- 定时任务运行记录
CREATE TABLE IF NOT EXISTS scheduler_runs (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  task_name VARCHAR(64) NOT NULL COMMENT '任务名（schedulerConfig 注册）',
  trigger_type ENUM('scheduled','manual') NOT NULL COMMENT '触发方式',
  status ENUM('running','success','skipped','failed') NOT NULL DEFAULT 'running' COMMENT '执行状态',
  message TEXT COMMENT '结果信息或错误原因',
  detail JSON NULL COMMENT '结构化明细（计数等）',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  finished_at TIMESTAMP NULL DEFAULT NULL COMMENT '结束时间',
  INDEX idx_task_started (task_name, started_at),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时任务运行记录';

-- 部署记录（CI deploy-history.jsonl + GitHub Actions runs 落库，按 run_id 幂等 upsert）
CREATE TABLE IF NOT EXISTS deploy_runs (
  run_id VARCHAR(32) PRIMARY KEY COMMENT 'GitHub Actions run id',
  commit_sha VARCHAR(64) NOT NULL DEFAULT '' COMMENT '提交 SHA',
  ref VARCHAR(255) NOT NULL DEFAULT '' COMMENT '分支/ref',
  actor VARCHAR(128) NOT NULL DEFAULT '' COMMENT '触发者',
  status VARCHAR(32) NOT NULL DEFAULT '' COMMENT '状态（success/failure/in_progress 等）',
  msg TEXT COMMENT 'commit message',
  deployed_at TIMESTAMP NULL DEFAULT NULL COMMENT '部署时间',
  started_at TIMESTAMP NULL DEFAULT NULL COMMENT '运行开始时间',
  finished_at TIMESTAMP NULL DEFAULT NULL COMMENT '运行结束时间',
  failure_job VARCHAR(255) DEFAULT NULL COMMENT '失败的 job 名',
  failure_step VARCHAR(255) DEFAULT NULL COMMENT '失败的 step 名',
  failure_excerpt TEXT COMMENT '失败日志尾部报错片段',
  failure_checked_at TIMESTAMP NULL DEFAULT NULL COMMENT '已拉取失败原因的时间（NULL=待拉取）',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_deployed_at (deployed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部署记录';

-- SSH 控制台会话审计日志
CREATE TABLE IF NOT EXISTS terminal_audit_logs (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  session_id VARCHAR(36) NOT NULL COMMENT '会话 ID',
  user_id VARCHAR(36) NOT NULL COMMENT '操作用户 ID',
  user_name VARCHAR(255) NOT NULL DEFAULT '' COMMENT '操作用户名',
  event VARCHAR(16) NOT NULL COMMENT '事件：connect / input / close',
  data TEXT COMMENT '输入的命令行（event=input 时）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_session (session_id),
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SSH 控制台审计日志';

-- 媒体解析结果缓存：按人隔离（u:{userId} 或 ip:{IP}），每人最多 10 条（超出淘汰并连带清理对应媒体资源）
CREATE TABLE IF NOT EXISTS media_parse_cache (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  person VARCHAR(80) NOT NULL COMMENT '隔离键：u:{userId} 或 ip:{IP}',
  url VARCHAR(512) NOT NULL COMMENT '提取后的分享链接',
  platform VARCHAR(16) NOT NULL COMMENT '平台：xhs / douyin / wechat',
  result JSON NOT NULL COMMENT '解析结果（标题/作者/封面/媒体地址）',
  stale TINYINT(1) NOT NULL DEFAULT 0 COMMENT '媒体地址已被上游拒绝（保留行做历史记录，getCachedParse 不命中）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间（LRU 依据）',
  UNIQUE KEY uk_person_url (person, url(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='媒体解析结果缓存';

-- 媒体资源缓存：源 CDN 文件旁路缓存到 COS 公有桶；7 天定时清理，或随解析记录淘汰连带清理
CREATE TABLE IF NOT EXISTS media_cache (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  person VARCHAR(80) NOT NULL COMMENT '隔离键：u:{userId} 或 ip:{IP}',
  parse_url VARCHAR(512) NOT NULL DEFAULT '' COMMENT '来源解析链接（随解析记录淘汰时连带清理；空串为无来源兜底）',
  url_hash CHAR(64) NOT NULL COMMENT 'sha256(源 CDN URL)',
  cos_key VARCHAR(255) NOT NULL COMMENT 'COS 公有桶对象 key',
  content_type VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'MIME 类型',
  size BIGINT NOT NULL DEFAULT 0 COMMENT '字节数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  last_access_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最近访问时间',
  UNIQUE KEY uk_person_hash (person, url_hash),
  INDEX idx_created (created_at),
  INDEX idx_person_parse (person, parse_url(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='媒体资源缓存（COS 旁路）';

-- 行情自选股：登录用户按账号存（跨设备互通）；访客存在前端 localStorage
CREATE TABLE IF NOT EXISTS market_watchlist (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '用户 ID',
  market VARCHAR(8) NOT NULL COMMENT '市场：cn / hk / us / jp / kr',
  code VARCHAR(16) NOT NULL COMMENT '标的代码（sh600519 / sh000001 / 00700 / AAPL / 7203 / 005930）',
  type VARCHAR(16) NOT NULL DEFAULT 'stock' COMMENT '标的类型：stock / etf / index',
  name VARCHAR(100) NOT NULL DEFAULT '' COMMENT '加入时的名称（行情拿不到时兜底显示）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  UNIQUE KEY uk_user_stock (user_id, market, code),
  INDEX idx_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='行情自选股';

-- 头部沪深300ETF规模占比：官方完整月份内的每日原始快照，金额统一为元
CREATE TABLE IF NOT EXISTS market_csi300_etf_snapshots (
  trade_date DATE PRIMARY KEY COMMENT '共同交易日',
  index_close DECIMAL(16,4) NOT NULL COMMENT '沪深300收盘点位',
  float_market_cap DECIMAL(20,2) NOT NULL COMMENT '沪深300流通市值（元）',
  funds JSON NOT NULL COMMENT '四只样本ETF：[{code, shares, unitNav}]，份额为份、单位净值非累计净值',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='头部沪深300ETF规模占比每日快照';

-- ============================================================
-- 多登录方式
-- ============================================================

-- 第三方登录身份：一个用户可绑定多个身份；未删除身份中 (provider, provider_uid) 唯一（解绑为软删除）
CREATE TABLE IF NOT EXISTS user_identities (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '所属用户 ID',
  provider VARCHAR(32) NOT NULL COMMENT '身份提供方（google）',
  provider_uid VARCHAR(128) NOT NULL COMMENT '提供方内的用户标识（Google sub）',
  email VARCHAR(255) NULL COMMENT '绑定时该身份的邮箱',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  provider_uid_active VARCHAR(128) GENERATED ALWAYS AS (IF(deleted_at IS NULL, provider_uid, NULL)) STORED COMMENT '未删除时=provider_uid（唯一约束用）',
  UNIQUE KEY uk_provider_uid_active (provider, provider_uid_active),
  INDEX idx_provider_uid (provider, provider_uid),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户第三方登录身份';

-- ============================================================
-- 用户合并记录：每次合并（成功或失败）一条；源用户合并后被软删除（users.deleted_at），保存 id/名字/邮箱快照，不建外键
-- ============================================================
CREATE TABLE IF NOT EXISTS user_merge_logs (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  operator_id VARCHAR(36) NOT NULL COMMENT '执行合并的管理员 ID',
  operator_name VARCHAR(255) NOT NULL DEFAULT '' COMMENT '执行人名字快照',
  source_user_id VARCHAR(36) NOT NULL COMMENT '被合并（软删除）的用户 ID',
  source_name VARCHAR(255) NOT NULL DEFAULT '' COMMENT '源用户名字快照',
  source_email VARCHAR(255) NOT NULL DEFAULT '' COMMENT '源用户邮箱快照',
  target_user_id VARCHAR(36) NOT NULL COMMENT '保留的目标用户 ID',
  target_name VARCHAR(255) NOT NULL DEFAULT '' COMMENT '目标用户名字快照',
  target_email VARCHAR(255) NOT NULL DEFAULT '' COMMENT '目标用户邮箱快照',
  modules JSON NULL COMMENT '各模块迁移数量与说明 [{name,label,moved,notes}]',
  conflicts JSON NULL COMMENT '合并时的冲突说明 [{module,label,message}]',
  status VARCHAR(16) NOT NULL COMMENT 'success / failed',
  error TEXT NULL COMMENT '失败原因',
  started_at DATETIME(3) NOT NULL COMMENT '开始时间',
  finished_at DATETIME(3) NOT NULL COMMENT '结束时间',
  INDEX idx_started (started_at),
  INDEX idx_target (target_user_id),
  INDEX idx_source (source_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户合并记录';

-- 用户偏好 KV（门户问候换一句等）；登录用户跨设备；访客走前端 localStorage
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id VARCHAR(36) NOT NULL COMMENT '用户 ID',
  pref_key VARCHAR(64) NOT NULL COMMENT '偏好键（如 portal-greeting）',
  pref_value JSON NOT NULL COMMENT '偏好 JSON',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (user_id, pref_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户偏好';

-- ============================================================
-- 想法（短帖流，替代原静态博客）：纯文本 + emoji，列表直出，仅管理员可发
-- ============================================================
CREATE TABLE IF NOT EXISTS thoughts (
  id VARCHAR(36) PRIMARY KEY COMMENT '想法唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '作者用户 ID',
  body TEXT NOT NULL COMMENT '正文（纯文本 + emoji，无 Markdown）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间（NULL 为未删除）',
  INDEX idx_created_at (created_at),
  INDEX idx_user_id (user_id),
  INDEX idx_deleted_at (deleted_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='想法短帖';

-- ============================================================
-- 想法点赞（登录用户可赞/取消；取消即硬删行）
-- ============================================================
CREATE TABLE IF NOT EXISTS thought_likes (
  id VARCHAR(36) PRIMARY KEY COMMENT '点赞记录唯一标识',
  thought_id VARCHAR(36) NOT NULL COMMENT '想法 ID',
  user_id VARCHAR(36) NOT NULL COMMENT '点赞用户 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  UNIQUE KEY uk_thought_user (thought_id, user_id),
  INDEX idx_thought_id (thought_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (thought_id) REFERENCES thoughts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='想法点赞';
