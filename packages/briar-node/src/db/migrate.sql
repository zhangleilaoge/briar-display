-- ============================================================
-- migrate.sql — 增量迁移（deploy.sh 每次部署自动执行）
-- 规则：
--   1. 所有语句必须幂等（可重复执行无副作用）
--   2. MySQL 不支持 ADD COLUMN IF NOT EXISTS，用 information_schema + PREPARE 动态判断
--   3. 迁移在全部环境生效后，清掉已执行的内容，只保留注释头
-- 完整建表见 schema.sql（make db-setup）
-- ============================================================

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

-- SQL 控制台权限初始化
INSERT INTO permissions (id, code, name, type, module) VALUES
  ('perm-page-sql-console', 'page:sql-console', '访问 SQL 控制台', 'page', 'admin'),
  ('perm-admin-sql-execute', 'admin:sql:execute', '执行 SQL', 'api', 'admin')
ON DUPLICATE KEY UPDATE name=name;

-- 超级管理员自动获得新权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-admin', id FROM permissions WHERE code IN ('page:sql-console', 'admin:sql:execute')
ON DUPLICATE KEY UPDATE role_id=role_id;

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

-- 应用部署权限初始化
INSERT INTO permissions (id, code, name, type, module) VALUES
  ('perm-admin-deploy-manage', 'admin:deploy:manage', '应用部署与证书', 'api', 'admin')
ON DUPLICATE KEY UPDATE name=name;

-- 超级管理员自动获得新权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-admin', id FROM permissions WHERE code IN ('admin:deploy:manage')
ON DUPLICATE KEY UPDATE role_id=role_id;

-- ============================================================
-- 图床升级为文件管理
-- ============================================================

-- images 表更名为 files（幂等：仅当旧表存在时执行）
SET @tbl_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'images');
SET @sql = IF(@tbl_exists = 1, 'RENAME TABLE images TO files', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

-- files 表支持任意文件类型：mime_type 扩长（MODIFY 幂等）
ALTER TABLE files MODIFY COLUMN mime_type VARCHAR(100) NOT NULL COMMENT 'MIME 类型';

-- files 表新增 folder_id（NULL = 根目录）
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'files' AND COLUMN_NAME = 'folder_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE files ADD COLUMN folder_id VARCHAR(36) NULL COMMENT ''所属文件夹 ID（NULL 为根目录）'' AFTER file_hash', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'files' AND INDEX_NAME = 'idx_folder_id');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE files ADD INDEX idx_folder_id (folder_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'files' AND CONSTRAINT_NAME = 'files_ibfk_folder');
SET @sql = IF(@fk_exists = 0, 'ALTER TABLE files ADD CONSTRAINT files_ibfk_folder FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 站内信
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '接收用户 ID',
  type VARCHAR(50) NOT NULL DEFAULT 'system' COMMENT '消息类型（system / file_blocked 等）',
  title VARCHAR(255) NOT NULL COMMENT '标题',
  content TEXT NOT NULL COMMENT '内容',
  read_at TIMESTAMP NULL DEFAULT NULL COMMENT '阅读时间（NULL 为未读）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_read (user_id, read_at),
  INDEX idx_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站内信';

-- ============================================================
-- 定时任务运行记录
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduler_runs (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  task_name VARCHAR(64) NOT NULL COMMENT '任务名（schedulerConfig 注册）',
  trigger_type ENUM('scheduled','manual') NOT NULL COMMENT '触发方式',
  status ENUM('running','success','failed') NOT NULL DEFAULT 'running' COMMENT '执行状态',
  message TEXT COMMENT '结果信息或错误原因',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  finished_at TIMESTAMP NULL DEFAULT NULL COMMENT '结束时间',
  INDEX idx_task_started (task_name, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时任务运行记录';

-- ============================================================
-- SSH 控制台
-- ============================================================

-- 会话审计日志
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

-- SSH 控制台权限初始化
INSERT INTO permissions (id, code, name, type, module) VALUES
  ('perm-admin-terminal-access', 'admin:terminal:access', 'SSH 控制台', 'api', 'admin')
ON DUPLICATE KEY UPDATE name=name;

-- 超级管理员自动获得新权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-admin', id FROM permissions WHERE code IN ('admin:terminal:access')
ON DUPLICATE KEY UPDATE role_id=role_id;

-- readme_ai 功能已下线，删除遗留表
DROP TABLE IF EXISTS readme_ai;

-- request_logs 增强：响应体（截断）+ 错误堆栈
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'request_logs' AND COLUMN_NAME = 'response_body');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE request_logs ADD COLUMN response_body TEXT NULL COMMENT ''响应体（截断 2000 字符，敏感字段脱敏）'' AFTER request_params', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'request_logs' AND COLUMN_NAME = 'error_stack');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE request_logs ADD COLUMN error_stack TEXT NULL COMMENT ''错误堆栈（仅未捕获异常）'' AFTER error_message', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- Wiki 模块下线
-- ============================================================

-- 清理 wiki 权限的角色关联（先删关联，再删权限）
DELETE FROM role_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE code LIKE 'wiki:%' OR code = 'page:wiki'
);

DELETE FROM permissions WHERE code LIKE 'wiki:%' OR code = 'page:wiki';

-- 删除 wiki 表（先子表后父表，DROP TABLE IF EXISTS 幂等）
DROP TABLE IF EXISTS wiki_page_categories;
DROP TABLE IF EXISTS wiki_page_tags;
DROP TABLE IF EXISTS wiki_discussion_replies;
DROP TABLE IF EXISTS wiki_discussions;
DROP TABLE IF EXISTS wiki_watchlist;
DROP TABLE IF EXISTS wiki_stars;
DROP TABLE IF EXISTS wiki_backlinks;
DROP TABLE IF EXISTS wiki_inline_comments;
DROP TABLE IF EXISTS wiki_change_requests;
DROP TABLE IF EXISTS wiki_revisions;
DROP TABLE IF EXISTS wiki_pages;
DROP TABLE IF EXISTS wiki_categories;
DROP TABLE IF EXISTS wiki_templates;
DROP TABLE IF EXISTS wiki_tags;
