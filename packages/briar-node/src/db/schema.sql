-- Briar 数据库初始化脚本
-- MySQL 8.0

-- 创建数据库
CREATE DATABASE IF NOT EXISTS briar_display
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE briar_display;

-- AI 项目认知表
CREATE TABLE IF NOT EXISTS readme_ai (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  project_path VARCHAR(512) NOT NULL UNIQUE COMMENT '项目绝对路径',
  project_name VARCHAR(255) NOT NULL COMMENT '项目名称',
  content LONGTEXT NOT NULL COMMENT 'readme.ai.md 内容',
  code_hash VARCHAR(64) COMMENT '代码目录结构hash，用于变更检测',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_project_path (project_path),
  INDEX idx_project_name (project_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 项目认知表';

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY COMMENT '用户唯一标识',
  name VARCHAR(100) NOT NULL COMMENT '用户名',
  email VARCHAR(255) NOT NULL UNIQUE COMMENT '邮箱',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_email (email),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 插入默认管理员账户（密码: admin123）
INSERT INTO users (id, name, email, password_hash) VALUES
  (UUID(), 'Briar Admin', 'admin@briar.dev', '$2a$10$YourHashedPasswordHere')
ON DUPLICATE KEY UPDATE name=name;

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

-- Wiki 文章表
CREATE TABLE IF NOT EXISTS wiki (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  title VARCHAR(255) NOT NULL COMMENT '文章标题',
  slug VARCHAR(255) NOT NULL UNIQUE COMMENT 'URL 友好的唯一标识',
  content LONGTEXT NOT NULL COMMENT 'Markdown 内容',
  summary VARCHAR(500) COMMENT '摘要（前500字）',
  author_id VARCHAR(36) NOT NULL COMMENT '作者 ID',
  view_count INT DEFAULT 0 COMMENT '浏览次数',
  status ENUM('draft', 'published') DEFAULT 'draft' COMMENT '状态：草稿/已发布',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  UNIQUE KEY uk_slug (slug),
  INDEX idx_author_id (author_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at),
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 文章表';