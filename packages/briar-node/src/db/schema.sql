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
  visibility ENUM('public','private','link_only') DEFAULT 'public' COMMENT '可见性：公开/私密/仅链接',
  author_id VARCHAR(36) NOT NULL COMMENT '创建者 ID',
  last_editor_id VARCHAR(36) COMMENT '最后编辑者 ID',
  parent_id VARCHAR(36) COMMENT '父页面 ID（子页面）',
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
  INDEX idx_parent_id (parent_id),
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at),
  FULLTEXT INDEX ft_search (title, content) WITH PARSER ngram,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (last_editor_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES wiki_pages(id) ON DELETE SET NULL
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

-- ===================== 新增功能表 =====================

-- Wiki 标签表
CREATE TABLE IF NOT EXISTS wiki_tags (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  name VARCHAR(100) NOT NULL UNIQUE COMMENT '标签名称',
  slug VARCHAR(100) NOT NULL UNIQUE COMMENT 'URL 友好的标识',
  color VARCHAR(7) DEFAULT '#3b82f6' COMMENT '标签颜色（hex）',
  page_count INT DEFAULT 0 COMMENT '关联文章数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_slug (slug),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 标签表';

-- Wiki 页面-标签关联表
CREATE TABLE IF NOT EXISTS wiki_page_tags (
  page_id VARCHAR(36) NOT NULL COMMENT '页面 ID',
  tag_id VARCHAR(36) NOT NULL COMMENT '标签 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '关联时间',
  PRIMARY KEY (page_id, tag_id),
  INDEX idx_tag_id (tag_id),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 页面-标签关联表';

-- Wiki 收藏表
CREATE TABLE IF NOT EXISTS wiki_stars (
  user_id VARCHAR(36) NOT NULL COMMENT '用户 ID',
  page_id VARCHAR(36) NOT NULL COMMENT '页面 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (user_id, page_id),
  INDEX idx_page_id (page_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 收藏表';

-- Wiki 反向链接表（提及关系）
CREATE TABLE IF NOT EXISTS wiki_backlinks (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  source_page_id VARCHAR(36) NOT NULL COMMENT '源页面 ID',
  target_page_id VARCHAR(36) NOT NULL COMMENT '目标页面 ID',
  source_slug VARCHAR(255) NOT NULL COMMENT '源页面 slug',
  target_slug VARCHAR(255) NOT NULL COMMENT '目标页面 slug',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uk_backlink (source_page_id, target_page_id),
  INDEX idx_target_page (target_page_id),
  INDEX idx_source_page (source_page_id),
  FOREIGN KEY (source_page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (target_page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 反向链接表';

-- Wiki 内联评论表（段落级评论）
CREATE TABLE IF NOT EXISTS wiki_inline_comments (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  page_id VARCHAR(36) NOT NULL COMMENT '关联页面 ID',
  anchor VARCHAR(255) NOT NULL COMMENT '锚点（段落 ID / 选择器）',
  content TEXT NOT NULL COMMENT '评论内容',
  author_id VARCHAR(36) NOT NULL COMMENT '评论者 ID',
  resolved BOOLEAN DEFAULT FALSE COMMENT '是否已解决',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_page_id (page_id),
  INDEX idx_anchor (anchor),
  INDEX idx_author_id (author_id),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 内联评论表';

-- Wiki 变更请求表（审核流程）
CREATE TABLE IF NOT EXISTS wiki_change_requests (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  page_id VARCHAR(36) NOT NULL COMMENT '关联页面 ID',
  title VARCHAR(255) COMMENT '变更后的标题',
  content LONGTEXT COMMENT '变更后的内容',
  summary VARCHAR(500) COMMENT '编辑摘要',
  status ENUM('pending','approved','rejected','merged') DEFAULT 'pending' COMMENT '状态',
  requester_id VARCHAR(36) NOT NULL COMMENT '请求者 ID',
  reviewer_id VARCHAR(36) COMMENT '审核者 ID',
  review_comment VARCHAR(500) COMMENT '审核意见',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  reviewed_at TIMESTAMP NULL COMMENT '审核时间',
  INDEX idx_page_id (page_id),
  INDEX idx_status (status),
  INDEX idx_requester_id (requester_id),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 变更请求表';

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
  code VARCHAR(100) NOT NULL UNIQUE COMMENT '权限编码（如 wiki:page:create）',
  name VARCHAR(100) NOT NULL COMMENT '权限名称',
  description VARCHAR(500) COMMENT '权限描述',
  type ENUM('page', 'api') NOT NULL COMMENT '权限类型：page=页面访问，api=功能操作',
  module VARCHAR(50) NOT NULL COMMENT '所属模块（wiki、admin、system）',
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
  ('role-user', 'user', '普通用户', '可创建和编辑文章，参与讨论和互动', 10, TRUE),
  ('role-moderator', 'moderator', '管理员', '可删除文章、管理分类、标签和模板', 50, TRUE),
  ('role-admin', 'admin', '超级管理员', '拥有所有权限，可管理用户、角色和系统配置', 100, TRUE)
ON DUPLICATE KEY UPDATE display_name=display_name;

-- 初始化权限数据
INSERT INTO permissions (id, code, name, type, module) VALUES
  -- 页面访问权限（默认开放，用于未来扩展）
  ('perm-page-wiki', 'page:wiki', '访问 Wiki', 'page', 'wiki'),
  ('perm-page-admin', 'page:admin', '访问管理后台', 'page', 'admin'),
  ('perm-page-business', 'page:business', '访问业务页面', 'page', 'system'),
  -- Wiki 读写权限（普通用户）
  ('perm-wiki-page-create', 'wiki:page:create', '创建 Wiki 页面', 'api', 'wiki'),
  ('perm-wiki-page-update', 'wiki:page:update', '编辑 Wiki 页面', 'api', 'wiki'),
  ('perm-wiki-discussion-create', 'wiki:discussion:create', '创建讨论', 'api', 'wiki'),
  ('perm-wiki-discussion-reply', 'wiki:discussion:reply', '回复讨论', 'api', 'wiki'),
  ('perm-wiki-comment-create', 'wiki:comment:create', '创建评论', 'api', 'wiki'),
  ('perm-wiki-comment-update', 'wiki:comment:update', '编辑自己的评论', 'api', 'wiki'),
  ('perm-wiki-change-request-create', 'wiki:change-request:create', '创建变更请求', 'api', 'wiki'),
  ('perm-wiki-watchlist-manage', 'wiki:watchlist:manage', '管理关注列表', 'api', 'wiki'),
  ('perm-wiki-star-manage', 'wiki:star:manage', '管理收藏', 'api', 'wiki'),
  -- Wiki 管理权限（管理员）
  ('perm-wiki-page-delete', 'wiki:page:delete', '删除 Wiki 页面', 'api', 'wiki'),
  ('perm-wiki-page-protect', 'wiki:page:protect', '保护 Wiki 页面', 'api', 'wiki'),
  ('perm-wiki-revision-revert', 'wiki:revision:revert', '回退版本', 'api', 'wiki'),
  ('perm-wiki-category-create', 'wiki:category:create', '创建分类', 'api', 'wiki'),
  ('perm-wiki-category-update', 'wiki:category:update', '编辑分类', 'api', 'wiki'),
  ('perm-wiki-category-delete', 'wiki:category:delete', '删除分类', 'api', 'wiki'),
  ('perm-wiki-tag-create', 'wiki:tag:create', '创建标签', 'api', 'wiki'),
  ('perm-wiki-tag-delete', 'wiki:tag:delete', '删除标签', 'api', 'wiki'),
  ('perm-wiki-template-create', 'wiki:template:create', '创建模板', 'api', 'wiki'),
  ('perm-wiki-template-update', 'wiki:template:update', '编辑模板', 'api', 'wiki'),
  ('perm-wiki-template-delete', 'wiki:template:delete', '删除模板', 'api', 'wiki'),
  ('perm-wiki-discussion-resolve', 'wiki:discussion:resolve', '标记讨论已解决', 'api', 'wiki'),
  ('perm-wiki-comment-delete', 'wiki:comment:delete', '删除评论', 'api', 'wiki'),
  ('perm-wiki-change-request-review', 'wiki:change-request:review', '审核变更请求', 'api', 'wiki'),
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

-- 管理员：Wiki 读写 + 管理权限（不含 admin:* 超级管理权限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-moderator', id FROM permissions WHERE code IN (
  'page:wiki', 'page:business',
  'wiki:page:create', 'wiki:page:update', 'wiki:page:delete', 'wiki:page:protect',
  'wiki:revision:revert',
  'wiki:category:create', 'wiki:category:update', 'wiki:category:delete',
  'wiki:tag:create', 'wiki:tag:delete',
  'wiki:template:create', 'wiki:template:update', 'wiki:template:delete',
  'wiki:discussion:create', 'wiki:discussion:reply', 'wiki:discussion:resolve',
  'wiki:comment:create', 'wiki:comment:update', 'wiki:comment:delete',
  'wiki:change-request:create', 'wiki:change-request:review',
  'wiki:watchlist:manage', 'wiki:star:manage'
)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- 普通用户：读写 + 创建标签/分类 + 删除自己的文章
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-user', id FROM permissions WHERE code IN (
  'page:wiki', 'page:business',
  'wiki:page:create', 'wiki:page:update', 'wiki:page:delete',
  'wiki:category:create', 'wiki:category:update',
  'wiki:tag:create',
  'wiki:discussion:create', 'wiki:discussion:reply',
  'wiki:comment:create', 'wiki:comment:update',
  'wiki:change-request:create',
  'wiki:watchlist:manage', 'wiki:star:manage'
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
  request_params JSON COMMENT '请求参数（query + body）',
  error_message TEXT COMMENT '错误信息（仅错误请求）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_trace_id (trace_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status),
  INDEX idx_duration (duration),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='请求日志表';

-- ============================================================
-- 图床系统表
-- ============================================================

-- 图片表
CREATE TABLE IF NOT EXISTS images (
  id VARCHAR(36) PRIMARY KEY COMMENT '唯一标识',
  user_id VARCHAR(36) NOT NULL COMMENT '上传者 ID',
  original_name VARCHAR(255) NOT NULL COMMENT '原始文件名',
  filename VARCHAR(255) NOT NULL COMMENT 'COS key: images/{userId}/{uuid}.{ext}',
  mime_type VARCHAR(50) NOT NULL COMMENT 'MIME 类型',
  size INT UNSIGNED NOT NULL COMMENT '文件大小（字节）',
  width INT UNSIGNED COMMENT '图片宽度',
  height INT UNSIGNED COMMENT '图片高度',
  cdn_url VARCHAR(500) NOT NULL COMMENT 'CDN 完整 URL',
  thumbnail_url VARCHAR(500) COMMENT '缩略图 URL',
  file_hash VARCHAR(64) COMMENT 'SHA-256 内容哈希（用于去重）',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_hash (user_id, file_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图床图片表';

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
