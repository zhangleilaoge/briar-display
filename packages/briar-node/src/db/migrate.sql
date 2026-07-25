-- ============================================================
-- migrate.sql — 增量迁移（deploy.sh 每次部署自动执行）
-- 规则：
--   1. 所有语句必须幂等（可重复执行无副作用）
--   2. MySQL 不支持 ADD COLUMN IF NOT EXISTS，用 information_schema + PREPARE 动态判断
--   3. 迁移在全部环境生效后，清掉已执行的内容，只保留注释头
-- 完整建表见 schema.sql（make db-setup）
-- ============================================================

-- 图床去重：images 表新增 file_hash 字段（MySQL 兼容写法）
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'images' AND COLUMN_NAME = 'file_hash');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE images ADD COLUMN file_hash VARCHAR(64) COMMENT ''SHA-256 内容哈希（用于去重）'' AFTER thumbnail_url', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'images' AND INDEX_NAME = 'idx_user_hash');
SET @sql = IF(@idx_exists = 0, 'ALTER TABLE images ADD INDEX idx_user_hash (user_id, file_hash)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
