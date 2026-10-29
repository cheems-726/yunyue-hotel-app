-- V157 阶段二 · 多班支持：class_state 多行（每班一行）+ class_code 唯一
--
-- 现状（V156 §3 清单）：class_state 单行 id=1 ⇒ 教学日历/锁周/注入表/续营/领班授权/学期状态全全局。
-- 本迁移使其支持多行：每班一行（class_code 唯一），现有 id=1 行回填 class_code='酒管2401'（现存真实班）。
--
-- 幂等：可重复执行。回滚见尾注释。

alter table public.class_state
  add column if not exists class_code text;

-- 回填现存行（id=1 是唯一的现存行；班级名 = 现网真实班）
update public.class_state set class_code = '酒管2401'
  where class_code is null and id = 1;

-- 保证唯一（新班 insert 时冲突即报错，不会静默混班）
alter table public.class_state
  add constraint class_state_class_code_key unique (class_code);

-- 班级读/写策略沿用现有 RLS（select: authenticated · update: is_teacher）—— 不新增 policy。
-- 应用侧：fetchClassState(classCode) / setClassWeek / setClassInjections / setClassContinue /
--         setSemesterStatus / advanceClassOffset 全部改为按 class_code 定位（见 supabaseClient.js V157 段）。
-- 迁移未应用 ⇒ 客户端回退 id=1 旧路径（fetchClassState 内 fallback 已有）。

-- 回滚（如需）：
-- alter table public.class_state drop constraint class_state_class_code_key;
-- alter table public.class_state drop column if exists class_code;
