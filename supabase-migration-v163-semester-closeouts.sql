-- V163 §1/§2 · 学期收口状态表（一键收口向导 + 冷备状态卡的服务端持久层）
-- 为什么建表：向导判据②「断点续跑 ⇒ 状态存在服务端而不是内存」——进度/文件清单/sha256 都落这张表。
-- 幂等：每班一行（class_code 唯一）· 重复收口 upsert，不产生第二份记录。
-- 红线：只增不改 —— 本表只记录收口产物与状态，绝不写 game_states/class_state 的经营数据。

create table if not exists public.semester_closeouts (
  id bigint generated always as identity primary key,
  class_code text not null unique,
  label text,                       -- 学期标签（如 2026秋）· 归档文件名必须含它（卡 §3）
  semester_status text,             -- 收口完成时的学期态（archived）
  steps jsonb default '{}'::jsonb,  -- {snapshot:{state,at,note}, coldbackup:{...}, finish:{...}, archive:{...}}
  files jsonb default '{}'::jsonb,  -- {名称:{size,sha256,content?}} · content 仅小件（快照JSON）内联
  created_by uuid,
  updated_at timestamptz default now()
);

alter table public.semester_closeouts enable row level security;

create policy semester_closeouts_read
  on public.semester_closeouts for select
  to authenticated
  using (true);

create policy semester_closeouts_teacher_write
  on public.semester_closeouts for all
  to authenticated
  using (is_teacher(auth.uid()))
  with check (is_teacher(auth.uid()));

-- 验收（迁移后手工执行）：
--   select class_code, label, steps from public.semester_closeouts;
