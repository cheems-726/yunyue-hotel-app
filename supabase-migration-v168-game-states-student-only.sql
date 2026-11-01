-- V168§1② · game_states 写权限收紧为学生（教师 JWT 一律拒 · 孤儿行双保险）
-- 实证：game_states 里 group_key='' 且 user_id=教师的行（capital=初始值）历史上三次全由教师登录触发
--       —— 客户端 guard（App 保存 effect 的 role 闸）之外，库侧再拦一层。
-- 语义：原 game_states_self = ALL USING/WITH CHECK (auth.uid() = user_id)；本迁移在两个表达式都
--       追加「写者 profiles.role 必须是 student」。教师/其他角色 UPDATE/INSERT 全被拒（SELECT 不变）。
-- 注意：服务端 tick/审计走 service_role（绕过 RLS），不受影响。

drop policy if exists game_states_self on public.game_states;
create policy game_states_self on public.game_states for all
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((select p.role from public.profiles p where p.user_id = auth.uid()), '') = 'student'
  )
  with check (
    auth.uid() = user_id
    and coalesce((select p.role from public.profiles p where p.user_id = auth.uid()), '') = 'student'
  );

-- 回滚（如需）：
-- drop policy if exists game_states_self on public.game_states;
-- create policy game_states_self on public.game_states for all to authenticated
--   using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 验收（迁移后）：
--   ① 教师登录 3 次 ⇒ game_states 行数不变（教师保存路径已被客户端 guard + 本策略双拦）
--   ② 教师 JWT 直写 game_states ⇒ 42501（RLS 拒绝）
--   ③ 学生登录保存 ⇒ 照常（student 角色通过）
