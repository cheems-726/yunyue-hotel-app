-- V157 阶段一 · 学期生命周期状态机（draft → running → finished → archived）
--
-- 状态语义（任务包-V157 §1）：
--   draft     未开课（新学期/新班默认态：学生端不能结算推进）
--   running   正在上课（现行为 —— 全部现存行视为 running）
--   finished  已结课：学生端只读（不能再推周/不能结算）；教师端仍可出成绩单
--   archived  已归档：只读快照；教师端可下载归档、可「新学期重置」（重置后回 draft）
--
-- 红线：结课/归档**绝不删数据**（只置状态 + 由应用层生成快照文件）。
-- 现存行回填：`running`（等价于改动前行为 —— 零变化）。
-- 幂等：add column if not exists + 默认值 ⇒ 可重复执行。

alter table public.class_state
  add column if not exists semester_status text not null default 'running';

-- 回填现存行（若历史上有行已是其他值，此处不改写 —— 只保证列存在 + 默认）
update public.class_state set semester_status = 'running'
  where semester_status is null or semester_status not in ('draft','running','finished','archived');

-- 回滚（如需）：
-- alter table public.class_state drop column if exists semester_status;
