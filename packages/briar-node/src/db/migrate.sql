-- Wiki 数据库迁移脚本
-- 执行方式: mysql -u <user> -p<pass> -h <host> briar_display < migrate.sql

-- 1. 新增 visibility 字段到 wiki_pages（如已存在请忽略此错误）
-- ALTER TABLE wiki_pages ADD COLUMN visibility ENUM('public','private','link_only') DEFAULT 'public' AFTER status;

-- 2. 新增 parent_id 字段到 wiki_pages（子页面，如已存在请忽略此错误）
-- ALTER TABLE wiki_pages ADD COLUMN parent_id VARCHAR(36) AFTER last_editor_id;
-- ALTER TABLE wiki_pages ADD CONSTRAINT fk_wiki_pages_parent FOREIGN KEY (parent_id) REFERENCES wiki_pages(id) ON DELETE SET NULL;

-- 3. 标签表
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

-- 4. 页面-标签关联表
CREATE TABLE IF NOT EXISTS wiki_page_tags (
  page_id VARCHAR(36) NOT NULL COMMENT '页面 ID',
  tag_id VARCHAR(36) NOT NULL COMMENT '标签 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '关联时间',
  PRIMARY KEY (page_id, tag_id),
  INDEX idx_tag_id (tag_id),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 页面-标签关联表';

-- 5. 收藏表
CREATE TABLE IF NOT EXISTS wiki_stars (
  user_id VARCHAR(36) NOT NULL COMMENT '用户 ID',
  page_id VARCHAR(36) NOT NULL COMMENT '页面 ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (user_id, page_id),
  INDEX idx_page_id (page_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Wiki 收藏表';

-- 6. 反向链接表
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

-- 7. 内联评论表
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

-- 8. 变更请求表
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
