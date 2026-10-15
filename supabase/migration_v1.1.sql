-- =====================================================================
-- Phase 1.1 增量迁移：动态岗位 + 面试日程
-- 使用方式：Supabase Dashboard -> SQL Editor -> 整段粘贴执行
-- （已执行过 Phase 1 schema.sql 的项目只需执行本文件）
-- =====================================================================

-- 1. 岗位表增加状态字段：active=招聘中（默认），closed=已停用
alter table positions
  add column if not exists status text not null default 'active'
  check (status in ('active', 'closed'));

-- 2. 面试日程按 scheduled_time 排序/查询的索引
create index if not exists interviews_scheduled_time_idx
  on interviews (scheduled_time);
