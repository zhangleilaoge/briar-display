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

-- ============================================================
-- Wiki 系统表（对齐 MediaWiki 命名空间设计）
-- ============================================================

-- Wiki 页面表（所有命名空间共用）
CREATE TABLE IF NOT EXISTS wiki_pages (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  title VARCHAR(255) NOT NULL COMMENT '页面标题',
  slug VARCHAR(255) NOT NULL COMMENT 'URL 友好的标识',
  content LONGTEXT NOT NULL COMMENT 'Markdown 源码',
  rendered_html LONGTEXT COMMENT '缓存的 HTML 渲染结果',
  summary VARCHAR(500) COMMENT '自动生成的摘要',
  namespace ENUM('main','talk','user','template','category') DEFAULT 'main' COMMENT '命名空间',
  status ENUM('draft','published','protected','deleted') DEFAULT 'published' COMMENT '页面状态',
  author_id VARCHAR(36) NOT NULL COMMENT '创建者 ID',
  last_editor_id VARCHAR(36) COMMENT '最后编辑者 ID',
  view_count INT DEFAULT 0 COMMENT '浏览次数',
  is_redirect BOOLEAN DEFAULT FALSE COMMENT '是否为重定向页面',
  redirect_target VARCHAR(255) COMMENT '重定向目标 slug',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_namespace_slug (namespace, slug),
  INDEX idx_status (status),
  INDEX idx_namespace (namespace),
  INDEX idx_author_id (author_id),
  INDEX idx_last_editor_id (last_editor_id),
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at),
  FULLTEXT INDEX ft_search (title, content) WITH PARSER ngram,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (last_editor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 页面表';

-- Wiki 版本历史表
CREATE TABLE IF NOT EXISTS wiki_revisions (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  page_id VARCHAR(36) NOT NULL COMMENT '关联页面 ID',
  content LONGTEXT NOT NULL COMMENT '该版本的 Markdown 源码',
  summary VARCHAR(500) COMMENT '编辑摘要',
  editor_id VARCHAR(36) NOT NULL COMMENT '编辑者 ID',
  revision_number INT NOT NULL COMMENT '递增版本号',
  size_before INT DEFAULT 0 COMMENT '编辑前字节数',
  size_after INT DEFAULT 0 COMMENT '编辑后字节数',
  minor_edit BOOLEAN DEFAULT FALSE COMMENT '小编辑标记',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uk_page_revision (page_id, revision_number),
  INDEX idx_page_id (page_id),
  INDEX idx_editor_id (editor_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (editor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 版本历史表';

-- Wiki 分类表（支持层级）
CREATE TABLE IF NOT EXISTS wiki_categories (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  name VARCHAR(255) NOT NULL COMMENT '分类名称',
  slug VARCHAR(255) NOT NULL UNIQUE COMMENT 'URL 友好的标识',
  description TEXT COMMENT '分类描述',
  parent_id VARCHAR(36) COMMENT '父分类 ID',
  page_count INT DEFAULT 0 COMMENT '该分类下的文章数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_parent_id (parent_id),
  INDEX idx_slug (slug),
  FOREIGN KEY (parent_id) REFERENCES wiki_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 分类表';

-- Wiki 页面-分类关联表
CREATE TABLE IF NOT EXISTS wiki_page_categories (
  page_id VARCHAR(36) NOT NULL COMMENT '页面 ID',
  category_id VARCHAR(36) NOT NULL COMMENT '分类 ID',
  PRIMARY KEY (page_id, category_id),
  INDEX idx_category_id (category_id),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES wiki_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 页面-分类关联表';

-- Wiki 讨论主题表
CREATE TABLE IF NOT EXISTS wiki_discussions (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  page_id VARCHAR(36) NOT NULL COMMENT '关联文章 ID',
  title VARCHAR(255) NOT NULL COMMENT '讨论主题标题',
  author_id VARCHAR(36) NOT NULL COMMENT '发起者 ID',
  resolved BOOLEAN DEFAULT FALSE COMMENT '是否已解决',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_page_id (page_id),
  INDEX idx_author_id (author_id),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 讨论主题表';

-- Wiki 讨论回复表
CREATE TABLE IF NOT EXISTS wiki_discussion_replies (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  topic_id VARCHAR(36) NOT NULL COMMENT '讨论主题 ID',
  content TEXT NOT NULL COMMENT '回复内容',
  author_id VARCHAR(36) NOT NULL COMMENT '回复者 ID',
  parent_reply_id VARCHAR(36) COMMENT '父回复 ID（嵌套回复）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_topic_id (topic_id),
  INDEX idx_author_id (author_id),
  FOREIGN KEY (topic_id) REFERENCES wiki_discussions(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (parent_reply_id) REFERENCES wiki_discussion_replies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 讨论回复表';

-- Wiki 关注列表表
CREATE TABLE IF NOT EXISTS wiki_watchlist (
  user_id VARCHAR(36) NOT NULL COMMENT '用户 ID',
  page_id VARCHAR(36) NOT NULL COMMENT '页面 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '关注时间',
  PRIMARY KEY (user_id, page_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 关注列表表';

-- Wiki 模板表
CREATE TABLE IF NOT EXISTS wiki_templates (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  name VARCHAR(255) NOT NULL COMMENT '模板名称',
  slug VARCHAR(255) NOT NULL UNIQUE COMMENT 'URL 友好的标识',
  content LONGTEXT NOT NULL COMMENT '模板内容（Markdown + {{参数}}）',
  description TEXT COMMENT '模板描述',
  author_id VARCHAR(36) NOT NULL COMMENT '创建者 ID',
  usage_count INT DEFAULT 0 COMMENT '使用次数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_slug (slug),
  INDEX idx_author_id (author_id),
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 模板表';