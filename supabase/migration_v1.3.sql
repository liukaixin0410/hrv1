-- =====================================================================
-- Phase 1.3 增量迁移：终态状态更名
--   录用     -> 面试通过
--   已淘汰   -> 面试不通过
-- 使用方式：Supabase Dashboard -> SQL Editor -> 整段粘贴执行
-- =====================================================================

-- 1. 先解除旧 CHECK 约束，否则写入新状态值会被拦截
alter table candidates
  drop constraint if exists candidates_status_check;

-- 2. 候选人当前状态
update candidates set status = '面试通过' where status = '录用';
update candidates set status = '面试不通过' where status = '已淘汰';

-- 3. 流转日志的结构化状态字段
update candidate_status_logs set from_status = '面试通过' where from_status = '录用';
update candidate_status_logs set to_status   = '面试通过' where to_status   = '录用';
update candidate_status_logs set from_status = '面试不通过' where from_status = '已淘汰';
update candidate_status_logs set to_status   = '面试不通过' where to_status   = '已淘汰';

-- 4. 同步系统生成的备注文案
update candidate_status_logs set note = replace(note, '确认录用', '确认面试通过');
update candidate_status_logs set note = replace(note, '淘汰候选人', '标记为不通过');

-- 5. 用新状态集合重建 CHECK 约束
alter table candidates
  add constraint candidates_status_check
  check (status in ('待筛', '初试排期', '初试完成', '复试排期', '复试完成', '面试不通过', '面试通过'));
