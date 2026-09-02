-- ============================================================
-- schema.sql — 完整数据库定义（目标态）
-- 用途：从零建库，make db-setup 调用，仅初始化时执行一次
-- 注意：部署流水线不会执行本文件；增量变更请写 migrate.sql
-- MySQL 8.0+
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS briar_display
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE briar_display;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY COMMENT '用户唯一标识',
  name VARCHAR(100) NOT NULL COMMENT '用户名',
  email VARCHAR(255) NOT NULL UNIQUE COMMENT '邮箱',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  avatar VARCHAR(500) COMMENT '头像 CDN URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
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
  name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色标识（英文）',
  display_name VARCHAR(100) NOT NULL COMMENT '角色显示名称',
  description VARCHAR(500) COMMENT '角色描述',
  level INT NOT NULL DEFAULT 0 COMMENT '角色等级（数字越大权限越高）',
  is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统内置角色（不可删除）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_name (name),
  INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(36) PRIMARY KEY COMMENT '权限唯一标识',
  code VARCHAR(100) NOT NULL UNIQUE COMMENT '权限编码（如 admin:role:manage）',
  name VARCHAR(100) NOT NULL COMMENT '权限名称',
  description VARCHAR(500) COMMENT '权限描述',
  type ENUM('page', 'api') NOT NULL COMMENT '权限类型：page=页面访问，api=功能操作',
  module VARCHAR(50) NOT NULL COMMENT '所属模块（admin、system）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_code (code),
  INDEX idx_type (type),
  INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(36) NOT NULL COMMENT '角色 ID',
  permission_id VARCHAR(36) NOT NULL COMMENT '权限 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色-权限关联表';

-- 用户-角色关联表
CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(36) NOT NULL COMMENT '用户 ID',
  role_id VARCHAR(36) NOT NULL COMMENT '角色 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
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

-- 初始化权限数据
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
  ('perm-admin-sql-execute', 'admin:sql:execute', '执行 SQL', 'api', 'admin')
ON DUPLICATE KEY UPDATE name=name;

-- ==================== 角色权限分配 ====================

-- 超级管理员：所有权限
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
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
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
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

-- 媒体解析结果缓存：按人隔离（u:{userId} 或 ip:{IP}），每人最多 10 条（超出淘汰并连带清理对应媒体资源）
CREATE TABLE IF NOT EXISTS media_parse_cache (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  person VARCHAR(80) NOT NULL COMMENT '隔离键：u:{userId} 或 ip:{IP}',
  url VARCHAR(512) NOT NULL COMMENT '提取后的分享链接',
  platform VARCHAR(16) NOT NULL COMMENT '平台：xhs / douyin / wechat',
  result JSON NOT NULL COMMENT '解析结果（标题/作者/封面/媒体地址）',
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
