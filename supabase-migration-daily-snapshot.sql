-- ============================================================================
-- 云悦酒店教学系统 · 迁移：daily_snapshots（每日快照归档）
-- ============================================================================
-- 用途：每天凌晨 2 点（北京时间）把各组 game_states 复制一份进快照表
--       防数据丢失 + 供历史回溯。全自动，玩家无感知。
--
-- ⚠️ 需人工执行：本文件不由 AI 执行，AI 也不会连接线上库。
-- 执行方式（二选一）：
--   A. Supabase 控制台 → 项目 yunyue-hotel → SQL Editor → 粘贴本文件全文 → Run
--   B. 已有 pg 直连时：node scripts/apply-daily-snapshot.cjs（读 SUPABASE_PG 环境变量，含 7 项只读校验）
--
-- 幂等性：
--   · 建表/索引：IF NOT EXISTS
--   · 策略：DROP POLICY IF EXISTS 后重建
--   · 函数：CREATE OR REPLACE
--   · 调度：cron.schedule(name, ...) 同名会更新（不会重复建 job）
--   · 归档本身：UNIQUE(snapshot_date, user_id) + ON CONFLICT DO UPDATE
--     → 同一天跑多次，结果完全一致（覆盖，不重复插入）
--
-- 【与结算严格分离】本文件只做"复制数据"，不含任何出租率/利润/属性/衰减计算。
--
-- 定稿：2026-09-21
-- ============================================================================

-- 1) 建表 ---------------------------------------------------------------------
create table if not exists public.daily_snapshots (
  id            uuid primary key default gen_random_uuid(),
  snapshot_date date not null,                                   -- 归档日期（北京时间当天）
  user_id       uuid references auth.users(id) on delete cascade,
  group_key     text,                                            -- '班级|组号'，未分组为 null
  week          integer,                                         -- 快照时点的经营周次
  state         jsonb,                                           -- game_states.state 的副本
  created_at    timestamptz not null default now(),
  constraint daily_snapshots_date_user_uq unique (snapshot_date, user_id)   -- 幂等键
);

-- 2) 索引 ---------------------------------------------------------------------
create index if not exists daily_snapshots_user_idx  on public.daily_snapshots (user_id);
create index if not exists daily_snapshots_date_idx  on public.daily_snapshots (snapshot_date desc);
create index if not exists daily_snapshots_group_idx on public.daily_snapshots (group_key);

-- 3) RLS + 策略（读开放两类，写一律不开放）------------------------------------
alter table public.daily_snapshots enable row level security;

-- 3.1 学生：可读自己的快照
drop policy if exists "daily_snapshots_student_read" on public.daily_snapshots;
create policy "daily_snapshots_student_read" on public.daily_snapshots for select
  using (auth.uid() = user_id);

-- 3.2 教师：可读全班快照（沿用现有函数 public.is_teacher）
drop policy if exists "daily_snapshots_teacher_read" on public.daily_snapshots;
create policy "daily_snapshots_teacher_read" on public.daily_snapshots for select
  using (public.is_teacher(auth.uid()));

-- 说明：刻意【不创建】任何 INSERT/UPDATE/DELETE 策略 —— 只有归档函数（security definer）能写。
--       RLS 对 security definer 函数不生效，故函数仍可正常写入。

-- 4) 归档函数 -----------------------------------------------------------------
-- 纯复制：把 game_states 每行的 state/week/group_key 复制进快照表；不做任何计算
create or replace function public.archive_daily()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date     date := (now() at time zone 'Asia/Shanghai')::date;  -- 北京时间当天
  v_archived int := 0;
  v_failed   int := 0;
  v_purged   int := 0;
  v_kept     int := 0;
begin
  -- ① 归档（一条集合式 INSERT..SELECT：等价于"遍历各组"，但原子且更快）
  begin
    insert into public.daily_snapshots (snapshot_date, user_id, group_key, week, state)
    select v_date, gs.user_id, gs.group_key, gs.week, gs.state
    from public.game_states gs
    where gs.user_id is not null
    on conflict (snapshot_date, user_id) do update
      set group_key  = excluded.group_key,
          week       = excluded.week,
          state      = excluded.state,
          created_at = now();          -- 同日重跑：覆盖并刷新时间戳
    get diagnostics v_archived = row_count;
  exception when others then
    v_failed := v_failed + 1;
    raise warning '[archive_daily] 归档失败（不阻断主流程）: %', sqlerrm;
  end;

  -- ② 保留策略：最近 60 天全量保留 + 长期保留"每周一"的锚点快照
  --    存储估算（30 人·第12周存档约 24KB）：60 天 ≈ 43MB；周一锚点每年 ≈ 37MB
  --    如需更省：把下方 isodow <> 1 改成 < v_date - interval '180 days'（180 天后全删）
  begin
    delete from public.daily_snapshots
    where snapshot_date < v_date - interval '60 days'
      and extract(isodow from snapshot_date) <> 1;
    get diagnostics v_purged = row_count;

    select count(*)::int into v_kept from public.daily_snapshots;
  exception when others then
    v_failed := v_failed + 1;
    raise warning '[archive_daily] 清理失败（不阻断主流程）: %', sqlerrm;
  end;

  -- ③ 返回统计（供 cron 日志/人工排查）
  return jsonb_build_object(
    'date', v_date,
    'archived', v_archived,
    'failed', v_failed,
    'purged', v_purged,
    'total_rows', v_kept
  );
end $$;

-- 只允许 cron（以 postgres 身份）调用；禁止 anon / authenticated 直接调用（避免学生手动触发全量归档）
revoke all on function public.archive_daily() from public, anon, authenticated;

-- 5) 定时调度（北京时间 02:00 = UTC 18:00）------------------------------------
-- 同名 job 重复执行本语句 = 更新该 job（不会重复创建）
select cron.schedule('daily-archive', '0 18 * * *', 'select public.archive_daily()');

-- ============================================================================
-- 6) 执行后自检（只读，可整段跑一遍确认）
-- ============================================================================
-- 表是否建立（应返回 daily_snapshots）：
--   select to_regclass('public.daily_snapshots');
-- RLS 是否启用（应 true）：
--   select relrowsecurity from pg_class where relname = 'daily_snapshots';
-- 策略（应 2 条：student_read / teacher_read）：
--   select policyname, cmd from pg_policies where tablename = 'daily_snapshots' order by policyname;
-- 索引（应 4 个：3 自定义 + 主键）：
--   select indexname from pg_indexes where tablename = 'daily_snapshots' order by indexname;
-- 函数是否存在（应 1 行）：
--   select proname, prosecdef from pg_proc where proname = 'archive_daily';
-- 调度（应 1 行，schedule = 0 18 * * *）：
--   select jobid, jobname, schedule, active from cron.job where jobname = 'daily-archive';
-- 手动试跑一次（可选，幂等安全：当天重复跑只是覆盖）：
--   select public.archive_daily();
-- 查看结果（应 0 或 N 行）：
--   select snapshot_date, count(*) from public.daily_snapshots group by 1 order by 1 desc limit 5;

-- ============================================================================
-- 7) 回滚（如需）
-- ============================================================================
-- select cron.unschedule('daily-archive');
-- drop function if exists public.archive_daily();
-- drop table if exists public.daily_snapshots;
