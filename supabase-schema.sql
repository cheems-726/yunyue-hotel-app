-- 云悦酒店教学系统 Schema v1（2026-09-08）
-- 设计：一组一档（game_states 存整个经营状态 JSONB），profiles 记角色，教师可读全部

-- 用户档案：角色 + 显示名 + 组号
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student',
  display_name text,
  group_no int,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- 教师判定函数（security definer 防递归 RLS）
create or replace function public.is_teacher(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.profiles where user_id = uid and role = 'teacher');
$$;
create policy "profiles_select" on public.profiles for select
  using (auth.uid() = user_id or public.is_teacher(auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert
  with check (auth.uid() = user_id or public.is_teacher(auth.uid()));
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = user_id or public.is_teacher(auth.uid()));

-- 新用户注册自动建档案（邮箱以 t 开头 = 教师，其余学生）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, role, display_name)
  values (new.id,
          case when new.email ~ '^[tT]\d*@' then 'teacher' else 'student' end,
          split_part(new.email, '@', 1));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 游戏状态：每个用户一条，整包 JSONB
create table if not exists public.game_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  group_name text,
  state jsonb not null default '{}'::jsonb,
  week int not null default 1,
  finished boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.game_states enable row level security;
-- 学生只能读写自己的
create policy "game_states_self" on public.game_states for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- 教师可读全部（排名/总览）
create policy "game_states_teacher_read" on public.game_states for select
  using (public.is_teacher(auth.uid()));
