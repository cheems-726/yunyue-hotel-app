-- ============================================================================
-- 云悦酒店教学系统 · 迁移：decision_log（决策流水表）  ← 【第1批】补做
-- ============================================================================
-- ✅ 状态：已于 2026-09-21 07:4x 应用到线上库，并只读校验通过：
--    表存在 / 3 条策略 / 4 个索引 / RLS 已启用 / 已加入 supabase_realtime 发布 / 8 字段齐全 / 0 行
--    执行器：scripts/apply-decision-log.cjs（读 SUPABASE_PG 环境变量，不含凭据，可重复执行——本文件幂等）
--
-- 重跑方式（幂等，安全）：
--   A. Supabase 控制台 → 项目 yunyue-hotel → SQL Editor → 粘贴本文件全文 → Run
--   B. SUPABASE_PG='postgresql://...' node scripts/apply-decision-log.cjs
--
-- 【下一步 · 写入侧接线（待用户安排）】—— 依赖本表：
--   ① supabaseClient.js 增加 saveDecisionLog / fetchDecisionLogs / subscribeDecisionLogs
--   ② App.jsx 在学生确认决策处写入（feedback 用 attrs 的真实变化文案，如「品质 +5（60→65）」）
--      TeacherDashboard 增加决策流水视图（路线图编号 R8）
--
-- 设计说明：
--   · game_states 是"一组一份 JSONB 整包"，无法追溯"谁做了什么决策"；
--     本表按行记录每次决策，供老师课堂实时查看"哪个组 / 哪个同学 / 做了什么 / 得到什么反馈"
--   · 追加写（append-only）：学生只有 insert/select 自己的策略，没有 update/delete
--     （日志表刻意不允许改写，fail-closed）
--   · 本表不影响结算与已上线功能；不写入不影响现有流程
-- 定稿：2026-09-20（N3）
-- ============================================================================

-- 1) 建表 ---------------------------------------------------------------------
create table if not exists public.decision_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  group_key    text,                      -- '班级|组号'，未分组为 null
  week         integer,
  decision_id  text,                      -- 如 'pricing'
  answer       text,                      -- 如 '跟降 10%'
  feedback     text,                      -- 如 '品质 +5（60→65）'
  created_at   timestamptz not null default now()
);

-- 2) 开启行级安全 -------------------------------------------------------------
alter table public.decision_log enable row level security;

-- 3) 三条策略（幂等：先删同名再建）-------------------------------------------
-- 3.1 学生：只能插入自己的记录
drop policy if exists "decision_log_student_insert" on public.decision_log;
create policy "decision_log_student_insert" on public.decision_log for insert
  with check (auth.uid() = user_id);

-- 3.2 学生：只能读自己的记录
drop policy if exists "decision_log_student_read" on public.decision_log;
create policy "decision_log_student_read" on public.decision_log for select
  using (auth.uid() = user_id);

-- 3.3 教师：可读全班（判定沿用现有函数 public.is_teacher，见 supabase-schema.sql:15）
drop policy if exists "decision_log_teacher_read" on public.decision_log;
create policy "decision_log_teacher_read" on public.decision_log for select
  using (public.is_teacher(auth.uid()));

-- 4) 索引 ---------------------------------------------------------------------
create index if not exists decision_log_user_created_idx on public.decision_log (user_id, created_at desc);
create index if not exists decision_log_group_created_idx on public.decision_log (group_key, created_at desc);
-- created_at 单独倒序索引（教师端"最近流水"按时间取）
create index if not exists decision_log_created_idx on public.decision_log (created_at desc);

-- 5) Realtime 发布（教师端流水实时刷新）--------------------------------------
-- 幂等写法：已在发布中则跳过（避免 "table is already member of publication" 报错）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'decision_log'
  ) then
    alter publication supabase_realtime add table public.decision_log;
  end if;
end $$;

-- ============================================================================
-- 6) 执行后自检（只读，可单独跑一遍确认）
-- ============================================================================
-- 表是否建立：
--   select to_regclass('public.decision_log') as created;
-- 三条策略是否到位（应返回 3 行：student_insert / student_read / teacher_read）：
--   select policyname, cmd from pg_policies where tablename = 'decision_log' order by policyname;
-- 索引是否建立（应含 user/group/created 三个）：
--   select indexname from pg_indexes where tablename = 'decision_log' order by indexname;
-- 是否已加入 realtime 发布（应返回 1 行）：
--   select * from pg_publication_tables where tablename = 'decision_log';
-- 当前行数（执行后为 0，接入写入后开始增长）：
--   select count(*) from public.decision_log;

-- ============================================================================
-- 7) 回滚（如需）
-- ============================================================================
-- drop policy if exists "decision_log_teacher_read" on public.decision_log;
-- drop policy if exists "decision_log_student_read"  on public.decision_log;
-- drop policy if exists "decision_log_student_insert" on public.decision_log;
-- alter publication supabase_realtime drop table public.decision_log;
-- drop table if exists public.decision_log;
