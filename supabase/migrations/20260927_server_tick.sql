-- 服务端逐日推进 · 触发与幂等（Wave 1 · W1-2）
-- ──────────────────────────────────────────────────────────────────
-- ⚠️【需用户执行】本迁移会改数据库结构与定时任务，按铁律#0 不得由执行端自行应用。
--    应用方式（Supabase 后台 SQL Editor 或 psql 直连）：
--      psql "$SUPABASE_PG" -f supabase/migrations/20260927_server_tick.sql
--    应用后自检：select * from public.class_day_now();  → 返回当日 classDay
--
-- 本迁移做四件事：
--   ① class_state 扩两个字段：开学日 start_date、老师偏移 teacher_offset_days
--   ② class_day_now()：classDay 的【唯一权威】= 服务端时间（客户端不参与判定，D7/B2）
--   ③ server_tick_log：幂等键表（tick_key 主键 → 同一天重复触发不会重复结算）
--   ④ pg_cron：每 10 分钟 POST 一次 Edge Function advance-day
-- 全部为【幂等/只新增】写法，可安全重跑。
-- ──────────────────────────────────────────────────────────────────

-- ① class_state 扩字段（只新增，不动既有列）
alter table public.class_state
  add column if not exists start_date date,
  add column if not exists teacher_offset_days int not null default 0;

comment on column public.class_state.start_date is '开学日（班级第 1 个游戏日）；classDay 的起算点';
comment on column public.class_state.teacher_offset_days is '老师手动偏移天数（提前/延后推进）；默认 0';

-- ② classDay 唯一权威 = 服务端时间
--    classDay = (服务端今天 − 开学日) + 1 + 老师偏移，下限 1
create or replace function public.class_day_now()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    1,
    (current_date - coalesce(cs.start_date, current_date))::int + 1 + coalesce(cs.teacher_offset_days, 0)
  )
  from public.class_state cs
  where cs.id = 1;
$$;

comment on function public.class_day_now() is
  'D7：classDay 的唯一权威来源（服务端时间）。客户端不得自行推算；离线档冻结在上次同步的 classDay。';

-- ③ 幂等键表：tick_key = 'd<classDay>|<groupKey>'
--    重复触发同一天 ⇒ 主键冲突 ⇒ 函数侧静默跳过（记 ok=true 的既有行不动）
create table if not exists public.server_tick_log (
  tick_key   text primary key,
  class_day  int not null,
  group_key  text,
  result     jsonb,
  ok         boolean not null default true,
  ran_at     timestamptz not null default now()
);

comment on table public.server_tick_log is
  '服务端推进的幂等流水。tick_key = d<classDay>|<groupKey>；主键冲突即"同一天已跑过"。';

create index if not exists server_tick_log_class_day_idx on public.server_tick_log (class_day);

alter table public.server_tick_log enable row level security;

-- 只允许教师读；学生不读（这是服务端运维流水，不是教学内容）
drop policy if exists server_tick_log_teacher_read on public.server_tick_log;
create policy server_tick_log_teacher_read on public.server_tick_log
  for select using (public.is_teacher(auth.uid()));

-- ④ pg_cron：每 10 分钟触发一次 Edge Function
--    ★ 需要 pg_cron 与 pg_net 扩展（Supabase 后台 Database → Extensions 打开）
--    ★ <PROJECT_REF> 需替换为你的项目 ref；service_role key 建议放 Vault 而非明文
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 取消同名旧任务（幂等重跑）
do $$
begin
  perform cron.unschedule('advance-day-tick');
exception when others then null;
end $$;

-- 每 10 分钟："是否有班级该推进"，由函数内部自行判断 classDay 与各组 lastComputedDay
select cron.schedule(
  'advance-day-tick',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/advance-day',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- ── 自检（应用后手动跑一次）────────────────────────────────────
-- ① classDay：        select public.class_day_now();
-- ② 幂等表存在：      select count(*) from public.server_tick_log;
-- ③ 定时任务在跑：    select jobname, schedule, active from cron.job where jobname = 'advance-day-tick';
-- ④ 最近调用记录：    select tick_key, class_day, ok, ran_at from public.server_tick_log order by ran_at desc limit 10;
-- ⑤ 回滚本迁移（如需）：
--      select cron.unschedule('advance-day-tick');
--      drop function if exists public.class_day_now();
--      drop table if exists public.server_tick_log;
--      alter table public.class_state drop column if exists start_date, drop column if exists teacher_offset_days;
