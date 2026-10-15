-- =====================================================================
-- Phase 1.2 增量迁移：面试官名册管理
-- 使用方式：Supabase Dashboard -> SQL Editor -> 整段粘贴执行
-- =====================================================================

-- 面试官名册（姓名唯一；interviews.interviewer 仍为文本快照，保留历史）
create table if not exists interviewers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- 与本项目其他表一致：本阶段不做行级权限隔离
alter table interviewers disable row level security;
