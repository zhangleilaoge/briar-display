-- ============================================================
-- migrate.sql — 临时迁移 / 数据修补（存量库专用）
-- 执行顺序：每次部署与建库都在 schema.sql 之后执行本文件（scripts/deploy.sh、src/db/setup.ts、src/db/migrate.ts）。
-- 约定：
--   1. 只放存量库需要的临时语句：ALTER（加列/改列/加索引，用 information_schema + PREPARE 判断）、
--      数据回填、一次性 UPDATE/DELETE、DROP 下线旧表等；每条都必须幂等（可重复执行无副作用）。
--   2. 结构变更必须同时改 schema.sql 中对应的 CREATE TABLE（schema.sql 才是唯一事实来源；
--      全新库靠 schema.sql 直接得到目标结构，本文件对其应为 no-op）。
--   3. 生产环境部署成功、确认已生效后，任何 agent 都可以把本文件清空到只剩这段头注释。
-- 当前：2026-10-28 业务数据统一软删除（deleted_at），唯一约束改为只约束未删除行。
-- ============================================================

-- 1) 各业务表加 deleted_at
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE roles ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE permissions ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'role_permissions' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE role_permissions ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_roles' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE user_roles ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'folders' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE folders ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'market_watchlist' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE market_watchlist ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_identities' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE user_identities ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT ''软删除时间（NULL 为未删除）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 2) 唯一约束只作用于未删除行：加 *_active 生成列 + 新唯一索引，再删旧唯一索引（新索引先建好，期间始终有唯一约束）
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_active') = 0,
  'ALTER TABLE users ADD COLUMN email_active VARCHAR(255) GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED COMMENT ''未删除时=email（唯一约束用）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_email_active') = 0,
  'ALTER TABLE users ADD UNIQUE KEY uk_email_active (email_active)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'email') > 0,
  'ALTER TABLE users DROP INDEX email', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'name_active') = 0,
  'ALTER TABLE roles ADD COLUMN name_active VARCHAR(50) GENERATED ALWAYS AS (IF(deleted_at IS NULL, name, NULL)) STORED COMMENT ''未删除时=name（唯一约束用）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND INDEX_NAME = 'uk_name_active') = 0,
  'ALTER TABLE roles ADD UNIQUE KEY uk_name_active (name_active)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND INDEX_NAME = 'name') > 0,
  'ALTER TABLE roles DROP INDEX name', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions' AND COLUMN_NAME = 'code_active') = 0,
  'ALTER TABLE permissions ADD COLUMN code_active VARCHAR(100) GENERATED ALWAYS AS (IF(deleted_at IS NULL, code, NULL)) STORED COMMENT ''未删除时=code（唯一约束用）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions' AND INDEX_NAME = 'uk_code_active') = 0,
  'ALTER TABLE permissions ADD UNIQUE KEY uk_code_active (code_active)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions' AND INDEX_NAME = 'code') > 0,
  'ALTER TABLE permissions DROP INDEX code', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_identities' AND COLUMN_NAME = 'provider_uid_active') = 0,
  'ALTER TABLE user_identities ADD COLUMN provider_uid_active VARCHAR(128) GENERATED ALWAYS AS (IF(deleted_at IS NULL, provider_uid, NULL)) STORED COMMENT ''未删除时=provider_uid（唯一约束用）''', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_identities' AND INDEX_NAME = 'uk_provider_uid_active') = 0,
  'ALTER TABLE user_identities ADD UNIQUE KEY uk_provider_uid_active (provider, provider_uid_active)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_identities' AND INDEX_NAME = 'idx_provider_uid') = 0,
  'ALTER TABLE user_identities ADD INDEX idx_provider_uid (provider, provider_uid)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_identities' AND INDEX_NAME = 'uk_provider_uid') > 0,
  'ALTER TABLE user_identities DROP INDEX uk_provider_uid', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
