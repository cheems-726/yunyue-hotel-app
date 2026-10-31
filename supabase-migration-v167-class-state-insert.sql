-- V167 · class_state 教师插入策略（建班向导的库侧合法性）
-- 现状：RLS 只有 UPDATE（class_state_teacher_write）⇒ 教师建班 INSERT 被 42501 拒
--       （V165 建班向导在线上必失败 · 审查回执 D353 后实测复现 2026-10-31）。
-- 影响面：仅放开"教师建班"；学生/匿名仍不可建班（is_teacher 闸在 with_check）。

create policy class_state_teacher_insert
  on public.class_state for insert
  to authenticated
  with check (is_teacher(auth.uid()));

-- 验收（迁移后手工执行 · 教师身份）：
--   insert into public.class_state (class_code, semester_status) values ('__probe_教师建班__', 'draft');
--   ⇒ 成功；再 delete 该探针行（教师无 delete 权限 ⇒ 由管理员清）。
