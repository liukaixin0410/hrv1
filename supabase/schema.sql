-- =====================================================================
-- 极简招聘与面试管理系统 —— Phase 1 数据库结构
-- 使用方式：Supabase Dashboard -> SQL Editor -> 整段粘贴执行
-- Phase 1 说明：不做 RLS 行级权限隔离，所有登录用户共享数据；
--               应用仅通过服务端 service_role key 访问数据库。
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. 岗位表（status: active=招聘中, closed=已停用）
-- ---------------------------------------------------------------------
create table if not exists positions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null unique,
  status      text not null default 'active' check (status in ('active', 'closed')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. 候选人表
-- ---------------------------------------------------------------------
create table if not exists candidates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  resume_url   text,
  resume_text  text,
  position_id  uuid not null references positions (id),
  status       text not null default '待筛',
  created_at   timestamptz not null default now(),
  constraint candidates_status_check check (
    status in ('待筛', '初试排期', '初试完成', '复试排期', '复试完成', '已淘汰', '录用')
  ),
  constraint candidates_resume_check check (
    resume_url is not null or resume_text is not null
  )
);

create index if not exists candidates_position_id_idx on candidates (position_id);
create index if not exists candidates_status_idx      on candidates (status);
create index if not exists candidates_created_at_idx  on candidates (created_at desc);

-- ---------------------------------------------------------------------
-- 3. 面试记录表（round: 1=初试, 2=复试；每个候选人每轮唯一一条）
-- ---------------------------------------------------------------------
create table if not exists interviews (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references candidates (id) on delete cascade,
  round           int  not null check (round in (1, 2)),
  scheduled_time  timestamptz,
  interviewer     text,
  feedback        text,
  operator_name   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (candidate_id, round)
);

create index if not exists interviews_candidate_id_idx on interviews (candidate_id);
create index if not exists interviews_scheduled_time_idx on interviews (scheduled_time);

-- ---------------------------------------------------------------------
-- 4. 状态流转日志（候选人时间线）
-- ---------------------------------------------------------------------
create table if not exists candidate_status_logs (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references candidates (id) on delete cascade,
  from_status    text,
  to_status      text not null,
  note           text,
  operator_name  text,
  created_at     timestamptz not null default now()
);

create index if not exists candidate_status_logs_candidate_idx
  on candidate_status_logs (candidate_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. Phase 1：关闭 RLS（团队内部约定协作，Phase 2 再做权限隔离）
-- ---------------------------------------------------------------------
alter table positions              disable row level security;
alter table candidates             disable row level security;
alter table interviews             disable row level security;
alter table candidate_status_logs  disable row level security;

-- ---------------------------------------------------------------------
-- 6. 简历文件存储桶（公开读，服务端 service_role 上传）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------
-- 7. 初始岗位种子数据
-- ---------------------------------------------------------------------
insert into positions (title) values
  ('招商总监'),
  ('品牌营销'),
  ('AI项目经理')
on conflict (title) do nothing;
